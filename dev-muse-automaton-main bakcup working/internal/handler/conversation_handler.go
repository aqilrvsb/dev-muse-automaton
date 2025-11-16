package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// ConversationHandler handles conversation-related HTTP requests
type ConversationHandler struct {
	conversationService *service.ConversationService
	authService         *service.AuthService
}

// NewConversationHandler creates a new conversation handler
func NewConversationHandler(conversationService *service.ConversationService, authService *service.AuthService) *ConversationHandler {
	return &ConversationHandler{
		conversationService: conversationService,
		authService:         authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token in Authorization header
func (h *ConversationHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
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

// CreateConversation creates a new conversation
// POST /api/conversations
func (h *ConversationHandler) CreateConversation(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Parse request body
	var req models.CreateConversationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// Validate required fields
	if req.ProspectNum == "" || req.IDDevice == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Prospect number and device ID are required",
		})
	}

	// Create conversation
	resp, err := h.conversationService.CreateConversation(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to create conversation",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GetConversation retrieves a specific conversation by prospect ID
// GET /api/conversations/:id
func (h *ConversationHandler) GetConversation(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get prospect ID from URL parameter
	prospectID := c.Params("id")
	if prospectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Prospect ID is required",
		})
	}

	// Get conversation
	resp, err := h.conversationService.GetConversation(c.Context(), userID, prospectID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get conversation",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetConversationsByDevice retrieves all conversations for a device
// GET /api/conversations/device/:deviceId?limit=50
func (h *ConversationHandler) GetConversationsByDevice(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get device ID from URL parameter
	deviceID := c.Params("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	// Get limit from query parameter (optional)
	limit := 0
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			limit = parsedLimit
		}
	}

	// Get conversations for device
	resp, err := h.conversationService.GetConversationsByDevice(c.Context(), userID, deviceID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get conversations",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetActiveConversations retrieves all active conversations for a device
// GET /api/conversations/device/:deviceId/active
func (h *ConversationHandler) GetActiveConversations(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get device ID from URL parameter
	deviceID := c.Params("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	// Get active conversations
	resp, err := h.conversationService.GetActiveConversations(c.Context(), userID, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get active conversations",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// UpdateConversation updates an existing conversation
// PUT /api/conversations/:id
func (h *ConversationHandler) UpdateConversation(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get prospect ID from URL parameter
	prospectID := c.Params("id")
	if prospectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Prospect ID is required",
		})
	}

	// Parse request body
	var req models.UpdateConversationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// Update conversation
	resp, err := h.conversationService.UpdateConversation(c.Context(), userID, prospectID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to update conversation",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// AddMessage adds a message to conversation history
// POST /api/conversations/:id/messages
func (h *ConversationHandler) AddMessage(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get prospect ID from URL parameter
	prospectID := c.Params("id")
	if prospectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Prospect ID is required",
		})
	}

	// Parse request body
	var req models.AddMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// Validate required fields
	if req.Role == "" || req.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Role and content are required",
		})
	}

	// Add message
	resp, err := h.conversationService.AddMessage(c.Context(), userID, prospectID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to add message",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// DeleteConversation deletes a conversation
// DELETE /api/conversations/:id
func (h *ConversationHandler) DeleteConversation(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get prospect ID from URL parameter
	prospectID := c.Params("id")
	if prospectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Prospect ID is required",
		})
	}

	// Delete conversation
	resp, err := h.conversationService.DeleteConversation(c.Context(), userID, prospectID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to delete conversation",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetConversationStats retrieves conversation statistics for a device
// GET /api/conversations/device/:deviceId/stats
func (h *ConversationHandler) GetConversationStats(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get device ID from URL parameter
	deviceID := c.Params("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	// Get stats
	stats, err := h.conversationService.GetConversationStats(c.Context(), userID, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get conversation stats",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"stats":   stats,
	})
}

// GetAllConversations retrieves all AI WhatsApp conversations for the authenticated user
// GET /api/conversations/all
func (h *ConversationHandler) GetAllConversations(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get all conversations for user
	resp, err := h.conversationService.GetAllConversationsForUser(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get conversations",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusInternalServerError).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
