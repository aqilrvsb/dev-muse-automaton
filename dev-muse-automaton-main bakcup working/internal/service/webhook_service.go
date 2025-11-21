package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
)

type WebhookService struct {
	deviceRepo *repository.DeviceRepository
	flowRepo   *repository.FlowRepository
}

// WebhookMessageRequest for sending messages internally
type WebhookMessageRequest struct {
	PhoneNumber string
	Message     string
	MediaURL    string
}

func NewWebhookService(deviceRepo *repository.DeviceRepository, flowRepo *repository.FlowRepository) *WebhookService {
	return &WebhookService{
		deviceRepo: deviceRepo,
		flowRepo:   flowRepo,
	}
}

// ExtractMessageData extracts and normalizes message data from webhook
func (s *WebhookService) ExtractMessageData(ctx context.Context, rawData map[string]interface{}, deviceID string, provider string) (*models.ExtractedMessage, error) {
	log.Printf("🔍 EXTRACTING MESSAGE DATA - Provider: %s, DeviceID: %s", provider, deviceID)
	log.Printf("🔍 RAW DATA KEYS: %+v", getMapKeys(rawData))

	if provider == "whacenter" {
		return s.extractWhacenterData(rawData, deviceID)
	} else if provider == "waha" {
		return s.extractWahaData(rawData, deviceID)
	}
	return nil, fmt.Errorf("unsupported provider: %s", provider)
}

// Helper to get map keys for debugging
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// extractWhacenterData extracts data from Whacenter webhook
func (s *WebhookService) extractWhacenterData(data map[string]interface{}, deviceID string) (*models.ExtractedMessage, error) {
	log.Printf("🔍 WHACENTER EXTRACTION - Full data: %+v", data)

	// Check if group message (skip groups)
	if isGroup, ok := data["isGroup"].(bool); ok && isGroup {
		log.Printf("⚠️  Skipping group message")
		return nil, fmt.Errorf("group messages are not supported")
	}

	message, _ := data["message"].(string)
	from, _ := data["from"].(string)
	phone, _ := data["phone"].(string)
	pushName, _ := data["pushName"].(string)

	log.Printf("🔍 WHACENTER FIELDS - message: %s, from: %s, phone: %s, pushName: %s", message, from, phone, pushName)

	// Use 'from' if available, otherwise 'phone'
	phoneNumber := from
	if phoneNumber == "" {
		phoneNumber = phone
	}

	// Trim whitespace from message
	message = strings.TrimSpace(message)

	// Validate phone number
	if !s.isValidPhoneNumber(phoneNumber, "whacenter") {
		log.Printf("❌ Invalid phone number: %s", phoneNumber)
		return nil, fmt.Errorf("invalid phone number format")
	}

	// Default name if not provided
	if pushName == "" {
		pushName = "Sis"
	}

	extracted := &models.ExtractedMessage{
		PhoneNumber: phoneNumber,
		Message:     message,
		Name:        pushName,
		Provider:    "whacenter",
		DeviceID:    deviceID,
	}

	log.Printf("✅ WHACENTER EXTRACTED: %+v", extracted)
	return extracted, nil
}

// extractWahaData extracts data from Waha webhook
func (s *WebhookService) extractWahaData(data map[string]interface{}, deviceID string) (*models.ExtractedMessage, error) {
	log.Printf("🔍 WAHA EXTRACTION - Full data: %+v", data)

	payload, ok := data["payload"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Missing payload in Waha webhook data")
		return nil, fmt.Errorf("missing payload in webhook data")
	}

	log.Printf("🔍 WAHA PAYLOAD: %+v", payload)

	message, _ := payload["body"].(string)
	fromRaw, _ := payload["from"].(string)

	log.Printf("🔍 WAHA FIELDS - message: %s, from: %s", message, fromRaw)

	// Trim whitespace from message
	message = strings.TrimSpace(message)
	if message == "" {
		return nil, fmt.Errorf("empty message")
	}

	// Check if group message (skip groups)
	if strings.HasSuffix(fromRaw, "@g.us") {
		return nil, fmt.Errorf("group messages are not supported")
	}

	var phoneNumber string
	var name string = "Sis"

	// Extract data info
	if dataInfo, ok := payload["_data"].(map[string]interface{}); ok {
		if info, ok := dataInfo["Info"].(map[string]interface{}); ok {
			if pushName, ok := info["PushName"].(string); ok && pushName != "" {
				name = pushName
			}
		}
	}

	// Handle different ID formats
	if strings.HasSuffix(fromRaw, "@c.us") {
		// Normal contact
		phoneNumber = strings.Split(fromRaw, "@")[0]
	} else if strings.HasSuffix(fromRaw, "@lid") {
		// LID mapping - check SenderAlt and RecipientAlt
		if dataInfo, ok := payload["_data"].(map[string]interface{}); ok {
			if info, ok := dataInfo["Info"].(map[string]interface{}); ok {
				senderAlt, _ := info["SenderAlt"].(string)
				recipientAlt, _ := info["RecipientAlt"].(string)

				// Try SenderAlt first, then RecipientAlt
				for _, alt := range []string{senderAlt, recipientAlt} {
					if alt != "" {
						if strings.HasSuffix(alt, "@c.us") || strings.HasSuffix(alt, "@s.whatsapp.net") {
							phoneNumber = strings.Split(alt, "@")[0]
							break
						}
					}
				}
			}
		}
	}

	// Validate phone number (must start with 601 for Malaysia)
	if !strings.HasPrefix(phoneNumber, "601") {
		return nil, fmt.Errorf("phone number must start with 601")
	}

	// Additional validation for phone number length
	if !s.isValidPhoneNumber(phoneNumber, "waha") {
		return nil, fmt.Errorf("invalid phone number format")
	}

	return &models.ExtractedMessage{
		PhoneNumber: phoneNumber,
		Message:     message,
		Name:        name,
		Provider:    "waha",
		DeviceID:    deviceID,
	}, nil
}

// isValidPhoneNumber validates phone number format
func (s *WebhookService) isValidPhoneNumber(phoneNumber string, provider string) bool {
	if phoneNumber == "" {
		return false
	}

	// Check length - must not exceed 13 characters or must start with 601
	if len(phoneNumber) > 13 && !strings.HasPrefix(phoneNumber, "601") {
		return false
	}

	return true
}

// SendMessage sends a message via Whacenter or Waha
func (s *WebhookService) SendMessage(ctx context.Context, device *models.DeviceSetting, req *WebhookMessageRequest) error {
	if device.Provider == "whacenter" {
		return s.sendWhacenterMessage(ctx, device, req)
	} else if device.Provider == "waha" {
		return s.sendWahaMessage(ctx, device, req)
	}
	return fmt.Errorf("unsupported provider: %s", device.Provider)
}

// sendWhacenterMessage sends message via Whacenter API
func (s *WebhookService) sendWhacenterMessage(ctx context.Context, device *models.DeviceSetting, req *WebhookMessageRequest) error {
	url := "https://api.whacenter.com/api/send"

	idDevice := ""
	if device.IDDevice != nil {
		idDevice = *device.IDDevice
	}

	payload := map[string]string{
		"device_id": idDevice,
		"number":    req.PhoneNumber,
		"message":   req.Message,
	}

	// Handle media files
	if req.MediaURL != "" {
		payload["file"] = req.MediaURL

		ext := strings.ToLower(filepath.Ext(req.MediaURL))
		if ext == ".mp4" {
			payload["type"] = "video"
		} else if ext == ".mp3" {
			payload["type"] = "audio"
		}
		// Images don't need type specification in Whacenter
	}

	// Convert payload to form data
	formData := ""
	for key, value := range payload {
		if formData != "" {
			formData += "&"
		}
		formData += fmt.Sprintf("%s=%s", key, value)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBufferString(formData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("whacenter API error: %s", string(body))
	}

	return nil
}

// sendWahaMessage sends message via Waha API
func (s *WebhookService) sendWahaMessage(ctx context.Context, device *models.DeviceSetting, req *WebhookMessageRequest) error {
	apiBase := "https://waha-plus-production-705f.up.railway.app"

	apiKey := ""
	if device.APIKey != nil {
		apiKey = *device.APIKey
	}

	session := ""
	if device.IDDevice != nil {
		session = *device.IDDevice
	}

	// Clean phone number
	phoneNumber := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, req.PhoneNumber)

	chatID := phoneNumber + "@c.us"

	var url string
	var payload interface{}

	if req.MediaURL == "" {
		// Text message only
		url = apiBase + "/api/sendText"
		payload = map[string]string{
			"session": session,
			"chatId":  chatID,
			"text":    req.Message,
		}
	} else {
		// Media message
		ext := strings.ToLower(filepath.Ext(req.MediaURL))

		if ext == ".mp4" {
			url = apiBase + "/api/sendVideo"
			payload = map[string]interface{}{
				"session": session,
				"chatId":  chatID,
				"file": map[string]string{
					"mimetype": "video/mp4",
					"url":      req.MediaURL,
					"filename": "Video",
				},
				"caption": req.Message,
			}
		} else if ext == ".mp3" {
			url = apiBase + "/api/sendFile"
			payload = map[string]interface{}{
				"session": session,
				"chatId":  chatID,
				"file": map[string]string{
					"mimetype": "audio/mp3",
					"url":      req.MediaURL,
					"filename": "Audio",
				},
				"caption": req.Message,
			}
		} else {
			// Image
			mimetype := s.detectImageMimeType(req.MediaURL, ext)
			url = apiBase + "/api/sendImage"
			payload = map[string]interface{}{
				"session": session,
				"chatId":  chatID,
				"file": map[string]string{
					"mimetype": mimetype,
					"url":      req.MediaURL,
					"filename": "Image",
				},
				"caption": req.Message,
			}
		}
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Api-Key", apiKey)

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("waha API error: %s", string(body))
	}

	return nil
}

// detectImageMimeType detects the MIME type for images
func (s *WebhookService) detectImageMimeType(fileURL string, ext string) string {
	mimeMap := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".bmp":  "image/bmp",
		".svg":  "image/svg+xml",
	}

	if mime, ok := mimeMap[ext]; ok {
		return mime
	}

	// Try to detect from HTTP headers
	resp, err := http.Head(fileURL)
	if err == nil && resp != nil {
		contentType := resp.Header.Get("Content-Type")
		if contentType != "" {
			return contentType
		}
	}

	// Default fallback
	return "image/jpeg"
}
