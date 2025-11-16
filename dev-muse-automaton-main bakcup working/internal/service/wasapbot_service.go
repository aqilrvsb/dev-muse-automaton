package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"fmt"
)

// WasapbotService handles WhatsApp Bot conversation business logic
type WasapbotService struct {
	wasapbotRepo *repository.WasapbotRepository
	deviceRepo   *repository.DeviceRepository
}

// NewWasapbotService creates a new wasapbot service
func NewWasapbotService(wasapbotRepo *repository.WasapbotRepository, deviceRepo *repository.DeviceRepository) *WasapbotService {
	return &WasapbotService{
		wasapbotRepo: wasapbotRepo,
		deviceRepo:   deviceRepo,
	}
}

// GetAllWasapbotForUser retrieves all WhatsApp Bot conversations for a user across all their devices
func (s *WasapbotService) GetAllWasapbotForUser(ctx context.Context, userID string) (*models.WasapbotResponse, error) {
	// Get all devices for the user
	devices, err := s.deviceRepo.GetDevicesByUserID(ctx, userID)
	if err != nil {
		return &models.WasapbotResponse{
			Success: false,
			Message: "Failed to retrieve user devices",
		}, nil
	}

	// Collect all conversations from all devices
	var allConversations []models.Wasapbot

	for _, device := range devices {
		deviceID := ""
		if device.IDDevice != nil {
			deviceID = *device.IDDevice
		} else if device.DeviceID != nil {
			deviceID = *device.DeviceID
		}

		if deviceID == "" {
			continue
		}

		// Get conversations for this device
		conversations, err := s.wasapbotRepo.GetConversationsByDevice(ctx, deviceID, 0)
		if err != nil {
			// Log error but continue with other devices
			continue
		}

		allConversations = append(allConversations, conversations...)
	}

	return &models.WasapbotResponse{
		Success:       true,
		Message:       fmt.Sprintf("Found %d conversations", len(allConversations)),
		Conversations: allConversations,
	}, nil
}
