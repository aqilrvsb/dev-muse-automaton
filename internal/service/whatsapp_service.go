package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"chatbot-automation/internal/whatsapp"
	"context"
	"fmt"
)

// WhatsAppService handles WhatsApp message sending
type WhatsAppService struct {
	deviceRepo *repository.DeviceRepository
	providers  map[string]whatsapp.Provider
}

// NewWhatsAppService creates a new WhatsApp service
func NewWhatsAppService(deviceRepo *repository.DeviceRepository) *WhatsAppService {
	return &WhatsAppService{
		deviceRepo: deviceRepo,
		providers:  make(map[string]whatsapp.Provider),
	}
}

// SendMessage sends a WhatsApp message using the appropriate provider
func (s *WhatsAppService) SendMessage(ctx context.Context, deviceID string, to string, message string, mediaType string, mediaURL string, mimeType ...string) error {
	// Get device
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, deviceID)
	if err != nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, deviceID)
		if err != nil {
			return fmt.Errorf("device not found: %w", err)
		}
	}

	if device == nil {
		return fmt.Errorf("device not found")
	}

	// Get provider configuration from device
	provider := device.Provider
	if provider == "" {
		provider = "waha" // Default
	}

	// Base URL and API Key configuration based on provider
	var baseURL string
	var apiKey string

	if provider == "waha" {
		// WAHA: Hardcoded URL and API key (not from database)
		baseURL = "https://waha-plus-production-705f.up.railway.app"
		apiKey = "dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0"
	} else if provider == "whacenter" {
		// Whacenter: Only URL, no API key needed
		baseURL = "https://api.whacenter.com"
		apiKey = "" // Whacenter doesn't use API key
	} else {
		// Other providers: Get both from database if available
		baseURL = "https://api.waha.pro" // Fallback
		if device.APIURL != nil && *device.APIURL != "" {
			baseURL = *device.APIURL
		}
		if device.APIKey != nil && *device.APIKey != "" {
			apiKey = *device.APIKey
		}
	}

	instance := deviceID
	if device.Instance != nil && *device.Instance != "" {
		instance = *device.Instance
	} else if device.IDDevice != nil && *device.IDDevice != "" {
		instance = *device.IDDevice
	}

	// Get or create provider
	whatsappProvider, err := s.getProvider(provider, baseURL, apiKey, instance)
	if err != nil {
		return fmt.Errorf("failed to get provider: %w", err)
	}

	// Build message request
	req := &models.SendMessageRequest{
		To:   to,
		Body: message,
		Type: "text",
	}

	// Set media type and URL if provided
	if mediaType != "" && mediaURL != "" {
		req.Type = mediaType
		req.MediaURL = mediaURL
		// Set MIME type if provided
		if len(mimeType) > 0 && mimeType[0] != "" {
			req.MimeType = mimeType[0]
		}
	}

	// Send message
	_, err = whatsappProvider.SendMessage(ctx, req)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	return nil
}

// getProvider gets or creates a WhatsApp provider instance
func (s *WhatsAppService) getProvider(providerName string, baseURL string, apiKey string, instance string) (whatsapp.Provider, error) {
	// Check cache
	cacheKey := fmt.Sprintf("%s:%s", providerName, instance)
	if provider, ok := s.providers[cacheKey]; ok {
		return provider, nil
	}

	// Create new provider
	config := &whatsapp.ProviderConfig{
		BaseURL:  baseURL,
		APIKey:   apiKey,
		Instance: instance,
	}

	var provider whatsapp.Provider
	switch providerName {
	case "waha":
		provider = whatsapp.NewWahaProvider(config)
	case "wablas":
		provider = whatsapp.NewWablasProvider(config)
	case "whacenter":
		provider = whatsapp.NewWhacenterProvider(config)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", providerName)
	}

	// Cache provider
	s.providers[cacheKey] = provider

	return provider, nil
}
