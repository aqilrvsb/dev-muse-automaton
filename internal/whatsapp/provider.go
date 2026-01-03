package whatsapp

import (
	"chatbot-automation/internal/models"
	"context"
)

// Provider defines the interface that all WhatsApp providers must implement
type Provider interface {
	// SendMessage sends a WhatsApp message
	SendMessage(ctx context.Context, message *models.SendMessageRequest) (*models.SendMessageResponse, error)

	// GetSessionStatus retrieves the session status
	GetSessionStatus(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error)

	// StartSession initiates a new WhatsApp session
	StartSession(ctx context.Context, deviceID string) (*models.SessionStatusResponse, error)

	// StopSession terminates a WhatsApp session
	StopSession(ctx context.Context, deviceID string) error

	// ParseWebhook parses incoming webhook payload
	ParseWebhook(payload map[string]interface{}) (*models.WebhookPayload, error)

	// GetProviderName returns the provider name (waha, wablas, whacenter)
	GetProviderName() string
}

// ProviderConfig holds configuration for WhatsApp providers
type ProviderConfig struct {
	Provider    string // waha, wablas, whacenter
	APIKey      string
	BaseURL     string
	DeviceID    string
	Instance    string
	PhoneNumber string
}
