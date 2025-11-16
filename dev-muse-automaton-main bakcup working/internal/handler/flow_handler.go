package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"

	"github.com/gofiber/fiber/v2"
)

// FlowHandler handles flow-related HTTP requests
type FlowHandler struct {
	flowService *service.FlowService
	authService *service.AuthService
}

// NewFlowHandler creates a new flow handler
func NewFlowHandler(flowService *service.FlowService, authService *service.AuthService) *FlowHandler {
	return &FlowHandler{
		flowService: flowService,
		authService: authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token in Authorization header
func (h *FlowHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
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

// CreateFlow creates a new chatbot flow
// POST /api/flows
func (h *FlowHandler) CreateFlow(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Parse request body
	var req models.CreateFlowRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// Validate required fields
	if req.IDDevice == "" || req.FlowName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID and flow name are required",
		})
	}

	// Create flow
	resp, err := h.flowService.CreateFlow(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to create flow",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GetFlow retrieves a specific flow by ID
// GET /api/flows/:id
func (h *FlowHandler) GetFlow(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get flow ID from URL parameter
	flowID := c.Params("id")
	if flowID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Flow ID is required",
		})
	}

	// Get flow
	resp, err := h.flowService.GetFlow(c.Context(), userID, flowID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get flow",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetFlowsByDevice retrieves all flows for a specific device
// GET /api/flows/device/:deviceId
func (h *FlowHandler) GetFlowsByDevice(c *fiber.Ctx) error {
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

	// Get flows for device
	resp, err := h.flowService.GetFlowsByDevice(c.Context(), userID, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get flows",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetAllUserFlows retrieves all flows for all user devices
// GET /api/flows
func (h *FlowHandler) GetAllUserFlows(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get all user flows
	resp, err := h.flowService.GetAllUserFlows(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get flows",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// UpdateFlow updates an existing flow
// PUT /api/flows/:id
func (h *FlowHandler) UpdateFlow(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get flow ID from URL parameter
	flowID := c.Params("id")
	if flowID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Flow ID is required",
		})
	}

	// Parse request body
	var req models.UpdateFlowRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// Update flow
	resp, err := h.flowService.UpdateFlow(c.Context(), userID, flowID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to update flow",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// DeleteFlow deletes a flow
// DELETE /api/flows/:id
func (h *FlowHandler) DeleteFlow(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get flow ID from URL parameter
	flowID := c.Params("id")
	if flowID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Flow ID is required",
		})
	}

	// Delete flow
	resp, err := h.flowService.DeleteFlow(c.Context(), userID, flowID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to delete flow",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusForbidden).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
