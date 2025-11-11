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

// WhacenterProvider implements the Provider interface for Whacenter (whacenter.com)
type WhacenterProvider struct {
	config *ProviderConfig
	client *http.Client
}

// NewWhacenterProvider creates a new Whacenter provider instance
func NewWhacenterProvider(config *ProviderConfig) *WhacenterProvider {
	return &WhacenterProvider{
		config: config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendMessage sends a WhatsApp message via Whacenter API
func (w *WhacenterProvider) SendMessage(ctx context.Context, message *models.SendMessageRequest) (*models.SendMessageResponse, error) {
	// Whacenter API endpoint - always use /api/send
	url := fmt.Sprintf("%s/api/send", w.config.BaseURL)

	// Build request payload - always include device_id
	payload := map[string]interface{}{
		"device_id": w.config.Instance,
		"number":    message.To,
		"message":   message.Body,
	}

	// Handle media messages - add type and file fields
	if message.Type != "" && message.Type != "text" && message.MediaURL != "" {
		payload["file"] = message.MediaURL
		payload["type"] = message.Type
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to marshal payload: %v", err),
		}, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, err
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	// Whacenter doesn't use API key header

	resp, err := w.client.Do(req)
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to send request: %v", err),
		}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to read response: %v", err),
		}, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return &models.SendMessageResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to parse response: %v", err),
		}, err
	}

	// Extract message ID
	messageID := ""
	if id, ok := result["message_id"].(string); ok {
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

// GetSessionStatus retrieves the session status from Whacenter
func (w *WhacenterProvider) GetSessionStatus(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error) {
	url := fmt.Sprintf("%s/status", w.config.BaseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, err
	}

	// Whacenter doesn't use API key header

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
		if statusStr == "authenticated" || statusStr == "connected" {
			status = "connected"
		}
	}

	qrCode := ""
	if qr, ok := result["qr"].(string); ok {
		qrCode = qr
	}

	return &models.SessionStatusResponse{
		Success: true,
		Message: "Session status retrieved",
		Session: &models.SessionInfo{
			SessionID:   deviceID,
			DeviceID:    deviceID,
			PhoneNumber: w.config.PhoneNumber,
			Status:      status,
			QRCode:      qrCode,
		},
	}, nil
}

// StartSession initiates a new WhatsApp session
func (w *WhacenterProvider) StartSession(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error) {
	url := fmt.Sprintf("%s/start", w.config.BaseURL)

	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, err
	}

	// Whacenter doesn't use API key header

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
func (w *WhacenterProvider) StopSession(ctx context.Context, deviceID string) error {
	url := fmt.Sprintf("%s/logout", w.config.BaseURL)

	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}

	// Whacenter doesn't use API key header

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

// ParseWebhook parses incoming webhook payload from Whacenter
func (w *WhacenterProvider) ParseWebhook(payload map[string]interface{}) (*models.WebhookPayload, error) {
	webhook := &models.WebhookPayload{
		Raw: payload,
	}

	// Extract event type
	if event, ok := payload["event"].(string); ok {
		webhook.Event = event
	}

	// Extract from
	if from, ok := payload["from"].(string); ok {
		webhook.From = from
	}

	// Extract message body
	if message, ok := payload["message"].(string); ok {
		webhook.Body = message
	} else if body, ok := payload["body"].(string); ok {
		webhook.Body = body
	}

	// Extract timestamp
	if timestamp, ok := payload["timestamp"].(float64); ok {
		webhook.Timestamp = int64(timestamp)
	}

	// Extract type
	if msgType, ok := payload["type"].(string); ok {
		webhook.Type = msgType
	}

	// Extract media URL if present
	if mediaURL, ok := payload["media_url"].(string); ok {
		webhook.MediaURL = mediaURL
	}

	return webhook, nil
}

// GetProviderName returns the provider name
func (w *WhacenterProvider) GetProviderName() string {
	return "whacenter"
}
