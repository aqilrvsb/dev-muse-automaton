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

// WablasProvider implements the Provider interface for Wablas (wablas.com)
type WablasProvider struct {
	config *ProviderConfig
	client *http.Client
}

// NewWablasProvider creates a new Wablas provider instance
func NewWablasProvider(config *ProviderConfig) *WablasProvider {
	return &WablasProvider{
		config: config,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendMessage sends a WhatsApp message via Wablas API
func (w *WablasProvider) SendMessage(ctx context.Context, message *models.SendMessageRequest) (*models.SendMessageResponse, error) {
	// Wablas API endpoint
	url := fmt.Sprintf("%s/api/send-message", w.config.BaseURL)

	// Build request payload
	payload := map[string]interface{}{
		"phone": message.To,
		"message": message.Body,
	}

	// Handle media messages
	if message.Type != "" && message.Type != "text" && message.MediaURL != "" {
		url = fmt.Sprintf("%s/api/send-image", w.config.BaseURL)
		payload = map[string]interface{}{
			"phone":   message.To,
			"image":   message.MediaURL,
			"caption": message.Body,
		}
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
	req.Header.Set("Authorization", w.config.APIKey)

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

// GetSessionStatus retrieves the session status from Wablas
func (w *WablasProvider) GetSessionStatus(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error) {
	url := fmt.Sprintf("%s/api/device/status", w.config.BaseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return &models.SessionStatusResponse{
			Success: false,
			Error:   fmt.Sprintf("failed to create request: %v", err),
		}, err
	}

	req.Header.Set("Authorization", w.config.APIKey)

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
	if connected, ok := result["connected"].(bool); ok && connected {
		status = "connected"
	}

	return &models.SessionStatusResponse{
		Success: true,
		Message: "Session status retrieved",
		Session: &models.SessionInfo{
			SessionID:   deviceID,
			DeviceID:    deviceID,
			PhoneNumber: w.config.PhoneNumber,
			Status:      status,
		},
	}, nil
}

// StartSession initiates a new WhatsApp session
func (w *WablasProvider) StartSession(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error) {
	// Wablas doesn't have explicit session start - connection is managed automatically
	return w.GetSessionStatus(ctx, deviceID)
}

// StopSession terminates a WhatsApp session
func (w *WablasProvider) StopSession(ctx context.Context, deviceID string) error {
	// Wablas doesn't have explicit session stop
	return nil
}

// ParseWebhook parses incoming webhook payload from Wablas
func (w *WablasProvider) ParseWebhook(payload map[string]interface{}) (*models.WebhookPayload, error) {
	webhook := &models.WebhookPayload{
		Raw: payload,
	}

	// Extract event type
	if pushName, ok := payload["pushname"].(string); ok && pushName != "" {
		webhook.Event = "message"
	}

	// Extract from
	if from, ok := payload["phone"].(string); ok {
		webhook.From = from
	}

	// Extract message body
	if message, ok := payload["message"].(string); ok {
		webhook.Body = message
	}

	// Extract timestamp
	if timestamp, ok := payload["timestamp"].(float64); ok {
		webhook.Timestamp = int64(timestamp)
	}

	// Extract type
	if msgType, ok := payload["type"].(string); ok {
		webhook.Type = msgType
	}

	return webhook, nil
}

// GetProviderName returns the provider name
func (w *WablasProvider) GetProviderName() string {
	return "wablas"
}
