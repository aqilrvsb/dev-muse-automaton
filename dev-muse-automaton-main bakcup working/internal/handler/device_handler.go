package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"

	"github.com/gofiber/fiber/v2"
)

// DeviceHandler handles device HTTP requests
type DeviceHandler struct {
	deviceService *service.DeviceService
	authService   *service.AuthService
}

// NewDeviceHandler creates a new device handler
func NewDeviceHandler(deviceService *service.DeviceService, authService *service.AuthService) *DeviceHandler {
	return &DeviceHandler{
		deviceService: deviceService,
		authService:   authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token
func (h *DeviceHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
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

// CreateDevice handles device creation
func (h *DeviceHandler) CreateDevice(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	var req models.CreateDeviceRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate required fields
	if req.Provider == "" || req.APIKeyOption == "" || req.PhoneNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "provider, api_key_option, and phone_number are required",
		})
	}

	// device_id is only required for wablas provider
	if req.Provider == "wablas" && req.DeviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "device_id is required for wablas provider",
		})
	}

	// Call service
	resp, err := h.deviceService.CreateDevice(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to create device",
			"error":   err.Error(),
		})
	}

	// If device already exists
	if !resp.Success {
		return c.Status(fiber.StatusConflict).JSON(resp)
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GetDevice handles retrieving a single device
func (h *DeviceHandler) GetDevice(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	deviceID := c.Params("id")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID required",
		})
	}

	// Call service
	resp, err := h.deviceService.GetDevice(c.Context(), userID, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get device",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetUserDevices handles retrieving all devices for a user
func (h *DeviceHandler) GetUserDevices(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Call service
	resp, err := h.deviceService.GetUserDevices(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get devices",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// UpdateDevice handles device update
func (h *DeviceHandler) UpdateDevice(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	deviceID := c.Params("id")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID required",
		})
	}

	var req models.UpdateDeviceRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Call service
	resp, err := h.deviceService.UpdateDevice(c.Context(), userID, deviceID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to update device",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// DeleteDevice handles device deletion
func (h *DeviceHandler) DeleteDevice(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	deviceID := c.Params("id")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID required",
		})
	}

	// Call service
	resp, err := h.deviceService.DeleteDevice(c.Context(), userID, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to delete device",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GenerateDevice handles automatic device generation via provider API
func (h *DeviceHandler) GenerateDevice(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	deviceID := c.Params("id")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID required",
		})
	}

	// Call service
	resp, err := h.deviceService.GenerateDevice(c.Context(), userID, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to generate device",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusBadRequest).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// CheckDeviceStatus handles device status check and QR code generation
func (h *DeviceHandler) CheckDeviceStatus(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	deviceID := c.Params("id")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID required",
		})
	}

	// Call service
	resp, err := h.deviceService.CheckDeviceStatus(c.Context(), userID, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to check device status",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusBadRequest).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
