package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"

	"github.com/gofiber/fiber/v2"
)

// AIHandler handles AI-related HTTP requests
type AIHandler struct {
	aiService   *service.AIService
	authService *service.AuthService
}

// NewAIHandler creates a new AI handler
func NewAIHandler(aiService *service.AIService, authService *service.AuthService) *AIHandler {
	return &AIHandler{
		aiService:   aiService,
		authService: authService,
	}
}

// GenerateCompletion handles AI completion generation
// POST /api/ai/completion
func (h *AIHandler) GenerateCompletion(c *fiber.Ctx) error {
	// Extract JWT from Authorization header
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Missing authorization token",
		})
	}

	// Remove "Bearer " prefix if present
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Validate token and get user ID
	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
		})
	}

	userID := claims.UserID

	// Parse request body
	var req models.AICompletionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate request
	if req.Provider == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Provider is required",
		})
	}

	if req.Model == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Model is required",
		})
	}

	if len(req.Messages) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Messages are required",
		})
	}

	if req.DeviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	// Generate completion
	response, err := h.aiService.GenerateCompletion(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to generate completion",
			"error":   err.Error(),
		})
	}

	// Check if access was denied
	if !response.Success && response.Message == "Access denied: device not found or unauthorized" {
		return c.Status(fiber.StatusForbidden).JSON(response)
	}

	// Check if generation failed
	if !response.Success {
		return c.Status(fiber.StatusBadRequest).JSON(response)
	}

	return c.JSON(response)
}

// SimpleChat handles simple chat requests
// POST /api/ai/chat
func (h *AIHandler) SimpleChat(c *fiber.Ctx) error {
	// Extract JWT from Authorization header
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Missing authorization token",
		})
	}

	// Remove "Bearer " prefix if present
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Validate token and get user ID
	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
		})
	}

	userID := claims.UserID

	// Parse request body
	var req models.ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate request
	if req.DeviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	if req.Message == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Message is required",
		})
	}

	// Generate chat response
	response, err := h.aiService.SimpleChat(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to generate chat response",
			"error":   err.Error(),
		})
	}

	// Check if access was denied
	if !response.Success && response.Message == "Access denied: device not found or unauthorized" {
		return c.Status(fiber.StatusForbidden).JSON(response)
	}

	// Check if generation failed
	if !response.Success {
		return c.Status(fiber.StatusBadRequest).JSON(response)
	}

	return c.JSON(response)
}

// TestConnection tests AI provider connection
// POST /api/ai/test
func (h *AIHandler) TestConnection(c *fiber.Ctx) error {
	// Extract JWT from Authorization header
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Missing authorization token",
		})
	}

	// Remove "Bearer " prefix if present
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Validate token and get user ID
	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
		})
	}

	userID := claims.UserID

	// Parse request body
	var req struct {
		Provider models.AIProvider `json:"provider"`
		Model    models.AIModel    `json:"model"`
		DeviceID string            `json:"device_id"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate request
	if req.Provider == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Provider is required",
		})
	}

	if req.Model == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Model is required",
		})
	}

	if req.DeviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	// Test with a simple message
	completionReq := &models.AICompletionRequest{
		Provider: req.Provider,
		Model:    req.Model,
		DeviceID: req.DeviceID,
		Messages: []models.AIMessage{
			{
				Role:    "user",
				Content: "Hello",
			},
		},
	}

	// Generate completion
	response, err := h.aiService.GenerateCompletion(c.Context(), userID, completionReq)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to test connection",
			"error":   err.Error(),
		})
	}

	// Check if access was denied
	if !response.Success && response.Message == "Access denied: device not found or unauthorized" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": response.Message,
		})
	}

	// Return connection test result
	return c.JSON(fiber.Map{
		"success": response.Success,
		"message": response.Message,
		"provider": req.Provider,
		"model": req.Model,
		"tested": true,
		"error": response.Error,
	})
}
