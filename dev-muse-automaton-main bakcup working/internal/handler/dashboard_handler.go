package handler

import (
	"chatbot-automation/internal/service"

	"github.com/gofiber/fiber/v2"
)

// DashboardHandler handles dashboard-related HTTP requests
type DashboardHandler struct {
	conversationService *service.ConversationService
	wasapbotService     *service.WasapbotService
	authService         *service.AuthService
}

// NewDashboardHandler creates a new dashboard handler
func NewDashboardHandler(conversationService *service.ConversationService, wasapbotService *service.WasapbotService, authService *service.AuthService) *DashboardHandler {
	return &DashboardHandler{
		conversationService: conversationService,
		wasapbotService:     wasapbotService,
		authService:         authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token in Authorization header
func (h *DashboardHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Authorization header required")
	}

	// Extract token from "Bearer <token>"
	token := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}

	// Validate token
	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Invalid or expired token")
	}

	return claims.UserID, nil
}

// GetCombinedData retrieves combined data from both Chatbot AI and WhatsApp Bot
// GET /api/dashboard/combined
func (h *DashboardHandler) GetCombinedData(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get Chatbot AI conversations
	chatbotResp, err := h.conversationService.GetAllConversationsForUser(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get Chatbot AI conversations",
			"error":   err.Error(),
		})
	}

	// Get WhatsApp Bot conversations
	wasapbotResp, err := h.wasapbotService.GetAllWasapbotForUser(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get WhatsApp Bot conversations",
			"error":   err.Error(),
		})
	}

	// Return combined data
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "Data retrieved successfully",
		"data": fiber.Map{
			"chatbot_ai":   chatbotResp.Conversations,
			"whatsapp_bot": wasapbotResp.Conversations,
		},
	})
}
