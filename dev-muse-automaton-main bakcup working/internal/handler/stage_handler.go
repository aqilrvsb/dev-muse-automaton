package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// StageHandler handles stage value HTTP requests
type StageHandler struct {
	stageService *service.StageService
	authService  *service.AuthService
}

// NewStageHandler creates a new stage handler
func NewStageHandler(stageService *service.StageService, authService *service.AuthService) *StageHandler {
	return &StageHandler{
		stageService: stageService,
		authService:  authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token
func (h *StageHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Authorization header required")
	}

	// Extract token
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

// CreateStageValue handles stage value creation
func (h *StageHandler) CreateStageValue(c *fiber.Ctx) error {
	var req models.CreateStageValueRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate required fields
	if req.IDDevice == "" || req.Stage == "" || req.TypeInputData == "" || req.ColumnsData == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "All fields are required",
		})
	}

	// Validate InputHardCode is required only when Type = "Set"
	if req.TypeInputData == "Set" && req.InputHardCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Input Hard Code is required when Type is Set",
		})
	}

	// Call service
	resp, err := h.stageService.CreateStageValue(c.Context(), &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to create stage value",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GetStageValue handles retrieving a single stage value
func (h *StageHandler) GetStageValue(c *fiber.Ctx) error {
	stageID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid stage ID",
		})
	}

	// Call service
	resp, err := h.stageService.GetStageValue(c.Context(), stageID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get stage value",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetAllStageValues handles retrieving all stage values (filtered by user's devices)
func (h *StageHandler) GetAllStageValues(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Call service with user filtering
	resp, err := h.stageService.GetStageValuesByUserID(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get stage values",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// UpdateStageValue handles stage value update
func (h *StageHandler) UpdateStageValue(c *fiber.Ctx) error {
	stageID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid stage ID",
		})
	}

	var req models.UpdateStageValueRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Call service
	resp, err := h.stageService.UpdateStageValue(c.Context(), stageID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to update stage value",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// DeleteStageValue handles stage value deletion
func (h *StageHandler) DeleteStageValue(c *fiber.Ctx) error {
	stageID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid stage ID",
		})
	}

	// Call service
	resp, err := h.stageService.DeleteStageValue(c.Context(), stageID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to delete stage value",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
