package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"fmt"
	"time"
)

// ConversationService handles conversation business logic
type ConversationService struct {
	conversationRepo *repository.ConversationRepository
	deviceRepo       *repository.DeviceRepository
}

// NewConversationService creates a new conversation service
func NewConversationService(conversationRepo *repository.ConversationRepository, deviceRepo *repository.DeviceRepository) *ConversationService {
	return &ConversationService{
		conversationRepo: conversationRepo,
		deviceRepo:       deviceRepo,
	}
}

// CreateConversation creates a new conversation for a prospect
func (s *ConversationService) CreateConversation(ctx context.Context, userID string, req *models.CreateConversationRequest) (*models.ConversationResponse, error) {
	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, req.IDDevice)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, req.IDDevice)
		if err != nil {
			return &models.ConversationResponse{
				Success: false,
				Message: "Device not found",
			}, nil
		}
	}

	// Verify ownership
	if device.UserID == nil || *device.UserID != userID {
		return &models.ConversationResponse{
			Success: false,
			Message: "Access denied - device does not belong to you",
		}, nil
	}

	// Check if conversation already exists for this prospect and device
	existing, err := s.conversationRepo.GetConversationByProspectNum(ctx, req.ProspectNum, req.IDDevice)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing conversation: %w", err)
	}

	if existing != nil {
		return &models.ConversationResponse{
			Success: false,
			Message: "Conversation already exists for this prospect and device",
			Conversation: existing,
		}, nil
	}

	// Create conversation
	conversation := &models.AIWhatsapp{
		ProspectNum: req.ProspectNum,
		IDDevice:    req.IDDevice,
		Stage:       req.Stage,
		Niche:       req.Niche,
		FlowID:      req.FlowID,
	}

	if err := s.conversationRepo.CreateConversation(ctx, conversation); err != nil {
		return nil, fmt.Errorf("failed to create conversation: %w", err)
	}

	return &models.ConversationResponse{
		Success:      true,
		Message:      "Conversation created successfully",
		Conversation: conversation,
	}, nil
}

// GetConversation retrieves a conversation by prospect ID
func (s *ConversationService) GetConversation(ctx context.Context, userID, prospectID string) (*models.ConversationResponse, error) {
	conversation, err := s.conversationRepo.GetConversationByID(ctx, prospectID)
	if err != nil {
		return &models.ConversationResponse{
			Success: false,
			Message: "Conversation not found",
		}, nil
	}

	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, conversation.IDDevice)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, conversation.IDDevice)
		if err != nil || device.UserID == nil || *device.UserID != userID {
			return &models.ConversationResponse{
				Success: false,
				Message: "Access denied",
			}, nil
		}
	} else if device.UserID == nil || *device.UserID != userID {
		return &models.ConversationResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	return &models.ConversationResponse{
		Success:      true,
		Conversation: conversation,
	}, nil
}

// GetConversationsByDevice retrieves all conversations for a device
func (s *ConversationService) GetConversationsByDevice(ctx context.Context, userID, deviceID string, limit int) (*models.ConversationResponse, error) {
	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, deviceID)
		if err != nil {
			return &models.ConversationResponse{
				Success: false,
				Message: "Device not found",
			}, nil
		}
	}

	// Verify ownership
	if device.UserID == nil || *device.UserID != userID {
		return &models.ConversationResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	// Get conversations using device identifier
	conversations, err := s.conversationRepo.GetConversationsByDevice(ctx, deviceID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversations: %w", err)
	}

	return &models.ConversationResponse{
		Success:       true,
		Message:       fmt.Sprintf("Found %d conversations", len(conversations)),
		Conversations: conversations,
	}, nil
}

// GetActiveConversations retrieves all active conversations for a device
func (s *ConversationService) GetActiveConversations(ctx context.Context, userID, deviceID string) (*models.ConversationResponse, error) {
	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, deviceID)
		if err != nil {
			return &models.ConversationResponse{
				Success: false,
				Message: "Device not found",
			}, nil
		}
	}

	// Verify ownership
	if device.UserID == nil || *device.UserID != userID {
		return &models.ConversationResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	// Get active conversations using device identifier
	conversations, err := s.conversationRepo.GetActiveConversationsByDevice(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get active conversations: %w", err)
	}

	return &models.ConversationResponse{
		Success:       true,
		Message:       fmt.Sprintf("Found %d active conversations", len(conversations)),
		Conversations: conversations,
	}, nil
}

// UpdateConversation updates a conversation
func (s *ConversationService) UpdateConversation(ctx context.Context, userID, prospectID string, req *models.UpdateConversationRequest) (*models.ConversationResponse, error) {
	// Get conversation and verify ownership
	conversation, err := s.conversationRepo.GetConversationByID(ctx, prospectID)
	if err != nil {
		return &models.ConversationResponse{
			Success: false,
			Message: "Conversation not found",
		}, nil
	}

	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, conversation.IDDevice)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, conversation.IDDevice)
		if err != nil || device.UserID == nil || *device.UserID != userID {
			return &models.ConversationResponse{
				Success: false,
				Message: "Access denied",
			}, nil
		}
	} else if device.UserID == nil || *device.UserID != userID {
		return &models.ConversationResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	// Build update map
	updates := make(map[string]interface{})

	if req.Stage != nil {
		updates["stage"] = *req.Stage
	}
	if req.Niche != nil {
		updates["niche"] = *req.Niche
	}
	// ConversationHistory removed - using conv_last field instead
	// if req.ConversationHistory != nil {
	// 	updates["conversation_history"] = *req.ConversationHistory
	// }
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.FlowID != nil {
		updates["flow_id"] = *req.FlowID
	}
	if req.CurrentNode != nil {
		updates["current_node"] = *req.CurrentNode
	}
	if req.SessionData != nil {
		updates["session_data"] = *req.SessionData
	}
	if req.Status != nil {
		updates["status"] = *req.Status
		// If marking as completed, set completed_at
		if *req.Status == "completed" {
			now := time.Now()
			updates["completed_at"] = now
			updates["is_active"] = false
		}
	}

	if len(updates) == 0 {
		return &models.ConversationResponse{
			Success: false,
			Message: "No fields to update",
		}, nil
	}

	if err := s.conversationRepo.UpdateConversation(ctx, prospectID, updates); err != nil {
		return nil, fmt.Errorf("failed to update conversation: %w", err)
	}

	// Get updated conversation
	updatedConversation, _ := s.conversationRepo.GetConversationByID(ctx, prospectID)

	return &models.ConversationResponse{
		Success:      true,
		Message:      "Conversation updated successfully",
		Conversation: updatedConversation,
	}, nil
}

// AddMessage adds a message to conversation history
func (s *ConversationService) AddMessage(ctx context.Context, userID, prospectID string, req *models.AddMessageRequest) (*models.ConversationResponse, error) {
	// Get conversation and verify ownership
	conversation, err := s.conversationRepo.GetConversationByID(ctx, prospectID)
	if err != nil {
		return &models.ConversationResponse{
			Success: false,
			Message: "Conversation not found",
		}, nil
	}

	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, conversation.IDDevice)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, conversation.IDDevice)
		if err != nil || device.UserID == nil || *device.UserID != userID {
			return &models.ConversationResponse{
				Success: false,
				Message: "Access denied",
			}, nil
		}
	} else if device.UserID == nil || *device.UserID != userID {
		return &models.ConversationResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	// Get existing conv_last (format: "User: message\nBot: reply")
	convLast := ""
	if conversation.ConvLast != nil {
		convLast = *conversation.ConvLast
	}

	// Add new message to conv_last
	prefix := ""
	if req.Role == "user" {
		prefix = "User:"
	} else if req.Role == "assistant" || req.Role == "system" {
		prefix = "Bot:"
	}

	newLine := fmt.Sprintf("%s %s", prefix, req.Content)
	if convLast != "" {
		convLast += "\n" + newLine
	} else {
		convLast = newLine
	}

	// Update conversation
	updates := map[string]interface{}{
		"conv_last":        convLast,
		"last_interaction": time.Now(),
	}

	if err := s.conversationRepo.UpdateConversation(ctx, prospectID, updates); err != nil {
		return nil, fmt.Errorf("failed to add message: %w", err)
	}

	// Get updated conversation
	updatedConversation, _ := s.conversationRepo.GetConversationByID(ctx, prospectID)

	return &models.ConversationResponse{
		Success:      true,
		Message:      "Message added successfully",
		Conversation: updatedConversation,
	}, nil
}

// DeleteConversation deletes a conversation
func (s *ConversationService) DeleteConversation(ctx context.Context, userID, prospectID string) (*models.ConversationResponse, error) {
	// Get conversation and verify ownership
	conversation, err := s.conversationRepo.GetConversationByID(ctx, prospectID)
	if err != nil {
		return &models.ConversationResponse{
			Success: false,
			Message: "Conversation not found",
		}, nil
	}

	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, conversation.IDDevice)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, conversation.IDDevice)
		if err != nil || device.UserID == nil || *device.UserID != userID {
			return &models.ConversationResponse{
				Success: false,
				Message: "Access denied",
			}, nil
		}
	} else if device.UserID == nil || *device.UserID != userID {
		return &models.ConversationResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	if err := s.conversationRepo.DeleteConversation(ctx, prospectID); err != nil {
		return nil, fmt.Errorf("failed to delete conversation: %w", err)
	}

	return &models.ConversationResponse{
		Success: true,
		Message: "Conversation deleted successfully",
	}, nil
}

// GetConversationStats retrieves conversation statistics
func (s *ConversationService) GetConversationStats(ctx context.Context, userID, deviceID string) (*models.ConversationStats, error) {
	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup device: %w", err)
	}

	if device == nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, deviceID)
		if err != nil {
			return nil, fmt.Errorf("device not found")
		}
	}

	// Verify ownership
	if device.UserID == nil || *device.UserID != userID {
		return nil, fmt.Errorf("access denied")
	}

	// Get stats using device identifier
	stats, err := s.conversationRepo.GetConversationStats(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation stats: %w", err)
	}

	return stats, nil
}

// GetAllConversationsForUser retrieves all AI WhatsApp conversations for a user across all their devices
func (s *ConversationService) GetAllConversationsForUser(ctx context.Context, userID string) (*models.ConversationResponse, error) {
	// Get all devices for the user
	devices, err := s.deviceRepo.GetDevicesByUserID(ctx, userID)
	if err != nil {
		return &models.ConversationResponse{
			Success: false,
			Message: "Failed to retrieve user devices",
		}, nil
	}

	// Collect all conversations from all devices
	var allConversations []models.AIWhatsapp

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
		conversations, err := s.conversationRepo.GetConversationsByDevice(ctx, deviceID, 0)
		if err != nil {
			// Log error but continue with other devices
			continue
		}

		allConversations = append(allConversations, conversations...)
	}

	return &models.ConversationResponse{
		Success:       true,
		Message:       fmt.Sprintf("Found %d conversations", len(allConversations)),
		Conversations: allConversations,
	}, nil
}

// GetAllConversations retrieves ALL conversations (admin only)
func (s *ConversationService) GetAllConversations(ctx context.Context) (*models.ConversationResponse, error) {
	// Get all devices
	devices, err := s.deviceRepo.GetAllDevices(ctx)
	if err != nil {
		return &models.ConversationResponse{
			Success: false,
			Message: "Failed to retrieve devices",
		}, nil
	}

	// Collect all conversations from all devices
	var allConversations []models.AIWhatsapp

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
		conversations, err := s.conversationRepo.GetConversationsByDevice(ctx, deviceID, 0)
		if err != nil {
			// Log error but continue with other devices
			continue
		}

		allConversations = append(allConversations, conversations...)
	}

	return &models.ConversationResponse{
		Success:       true,
		Message:       fmt.Sprintf("Found %d conversations (admin view)", len(allConversations)),
		Conversations: allConversations,
	}, nil
}
