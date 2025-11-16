package whatsapp

import (
	"bytes"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// WahaProvider implements the Provider interface for Waha (waha.devlike.pro)
type WahaProvider struct {
	config *ProviderConfig
	client *http.Client
}

// NewWahaProvider creates a new Waha provider instance
func NewWahaProvider(config *ProviderConfig) *WahaProvider {
	return &WahaProvider{
		config: config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendMessage sends a WhatsApp message via Waha API
func (w *WahaProvider) SendMessage(ctx context.Context, message *models.SendMessageRequest) (*models.SendMessageResponse, error) {
	// Waha API endpoint for sending messages
	url := fmt.Sprintf("%s/api/sendText", w.config.BaseURL)

	// Build request payload
	payload := map[string]interface{}{
		"session": w.config.Instance,
		"chatId":  message.To + "@c.us",
		"text":    message.Body,
	}

	// Handle media messages - use specific endpoints for each type
	if message.Type != "" && message.Type != "text" && message.MediaURL != "" {
		if message.Type == "video" {
			url = fmt.Sprintf("%s/api/sendVideo", w.config.BaseURL)
			// Use provided MIME type or default
			videoMimetype := "video/mp4"
			if message.MimeType != "" {
				videoMimetype = message.MimeType
			}
			payload = map[string]interface{}{
				"session": w.config.Instance,
				"chatId":  message.To + "@c.us",
				"file": map[string]interface{}{
					"mimetype": videoMimetype,
					"url":      message.MediaURL,
					"filename": "Video",
				},
				"caption": message.Body,
			}
		} else if message.Type == "audio" {
			url = fmt.Sprintf("%s/api/sendFile", w.config.BaseURL)
			// Use provided MIME type or default
			audioMimetype := "audio/mp3"
			if message.MimeType != "" {
				audioMimetype = message.MimeType
			}
			payload = map[string]interface{}{
				"session": w.config.Instance,
				"chatId":  message.To + "@c.us",
				"file": map[string]interface{}{
					"mimetype": audioMimetype,
					"url":      message.MediaURL,
					"filename": "Audio",
				},
				"caption": message.Body,
			}
		} else if message.Type == "image" {
			url = fmt.Sprintf("%s/api/sendImage", w.config.BaseURL)
			// Use provided MIME type or detect from URL extension
			mimetype := "image/jpeg" // default
			if message.MimeType != "" {
				mimetype = message.MimeType
			} else if contains(message.MediaURL, ".png") {
				mimetype = "image/png"
			} else if contains(message.MediaURL, ".gif") {
				mimetype = "image/gif"
			} else if contains(message.MediaURL, ".webp") {
				mimetype = "image/webp"
			}
			payload = map[string]interface{}{
				"session": w.config.Instance,
				"chatId":  message.To + "@c.us",
				"file": map[string]interface{}{
					"mimetype": mimetype,
					"url":      message.MediaURL,
					"filename": "Image",
				},
				"caption": message.Body,
			}
		}
	}

	// Marshal payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to marshal payload: %v", err),
		}, err
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, err
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	if w.config.APIKey != "" {
		req.Header.Set("X-Api-Key", w.config.APIKey)
	}

	// Send request
	resp, err := w.client.Do(req)
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to send request: %v", err),
		}, err
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to read response: %v", err),
		}, err
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to parse response: %v", err),
		}, err
	}

	// Extract message ID
	messageID := ""
	if id, ok := result["id"].(string); ok {
		messageID = id
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return &models.SendMessageResponse{
			Success:   true,
			Message:   "Message sent successfully",
			MessageID: messageID,
		}, nil
	}

	return &models.SendMessageResponse{
		Success: false,
		Error:   fmt.Sprintf("API error: %s", string(body)),
	}, fmt.Errorf("API returned status %d", resp.StatusCode)
}

// GetSessionStatus retrieves the session status from Waha
func (w *WahaProvider) GetSessionStatus(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error) {
	url := fmt.Sprintf("%s/api/sessions/%s", w.config.BaseURL, w.config.Instance)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, err
	}

	// Set headers
	if w.config.APIKey != "" {
		req.Header.Set("X-Api-Key", w.config.APIKey)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to send request: %v", err),
		}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to read response: %v", err),
		}, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to parse response: %v", err),
		}, err
	}

	status := "disconnected"
	if statusStr, ok := result["status"].(string); ok {
		status = statusStr
	}

	qrCode := ""
	if qr, ok := result["qr"].(string); ok {
		qrCode = qr
	}

	return &models.SessionStatusResponse{
		Success: true,
		Message: "Session status retrieved",
		Session: &models.SessionInfo{
			SessionID:   w.config.Instance,
			DeviceID:    deviceID,
			PhoneNumber: w.config.PhoneNumber,
			Status:      status,
			QRCode:      qrCode,
		},
	}, nil
}

// StartSession initiates a new WhatsApp session
func (w *WahaProvider) StartSession(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error) {
	url := fmt.Sprintf("%s/api/sessions", w.config.BaseURL)

	payload := map[string]interface{}{
		"name": w.config.Instance,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to marshal payload: %v", err),
		}, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, err
	}

	req.Header.Set("Content-Type", "application/json")
	if w.config.APIKey != "" {
		req.Header.Set("X-Api-Key", w.config.APIKey)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to send request: %v", err),
		}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Wait a bit and get QR code
		time.Sleep(2 * time.Second)
		return w.GetSessionStatus(ctx, deviceID)
	}

	body, _ := io.ReadAll(resp.Body)
	return &models.SessionStatusResponse{
		Success: false,
		Error:   fmt.Sprintf("failed to start session: %s", string(body)),
	}, fmt.Errorf("API returned status %d", resp.StatusCode)
}

// StopSession terminates a WhatsApp session
func (w *WahaProvider) StopSession(ctx context.Context, deviceID string) error {
	url := fmt.Sprintf("%s/api/sessions/%s/stop", w.config.BaseURL, w.config.Instance)

	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}

	if w.config.APIKey != "" {
		req.Header.Set("X-Api-Key", w.config.APIKey)
	}

	resp, err := w.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	return fmt.Errorf("failed to stop session, status: %d", resp.StatusCode)
}

// ParseWebhook parses incoming webhook payload from Waha
func (w *WahaProvider) ParseWebhook(payload map[string]interface{}) (*models.WebhookPayload, error) {
	webhook := &models.WebhookPayload{
		Raw: payload,
	}

	// Extract event type
	if event, ok := payload["event"].(string); ok {
		webhook.Event = event
	}

	// Extract session
	if session, ok := payload["session"].(string); ok {
		webhook.Session = session
	}

	// Extract message data
	if payloadData, ok := payload["payload"].(map[string]interface{}); ok {
		// Extract from
		if from, ok := payloadData["from"].(string); ok {
			webhook.From = from
		}

		// Extract body/text
		if body, ok := payloadData["body"].(string); ok {
			webhook.Body = body
		}

		// Extract timestamp
		if timestamp, ok := payloadData["timestamp"].(float64); ok {
			webhook.Timestamp = int64(timestamp)
		}

		// Extract type
		if msgType, ok := payloadData["type"].(string); ok {
			webhook.Type = msgType
		}
	}

	return webhook, nil
}

// GetProviderName returns the provider name
func (w *WahaProvider) GetProviderName() string {
	return "waha"
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
