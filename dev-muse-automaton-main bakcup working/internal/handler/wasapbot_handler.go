package handler

import (
	"chatbot-automation/internal/service"

	"github.com/gofiber/fiber/v2"
)

// WasapbotHandler handles WhatsApp Bot conversation-related HTTP requests
type WasapbotHandler struct {
	wasapbotService *service.WasapbotService
	authService     *service.AuthService
}

// NewWasapbotHandler creates a new wasapbot handler
func NewWasapbotHandler(wasapbotService *service.WasapbotService, authService *service.AuthService) *WasapbotHandler {
	return &WasapbotHandler{
		wasapbotService: wasapbotService,
		authService:     authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token in Authorization header
func (h *WasapbotHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
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

// GetAllWasapbot retrieves all WhatsApp Bot conversations for the authenticated user
// GET /api/wasapbot/all
func (h *WasapbotHandler) GetAllWasapbot(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get all wasapbot conversations for user
	resp, err := h.wasapbotService.GetAllWasapbotForUser(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get WhatsApp Bot conversations",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusInternalServerError).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
