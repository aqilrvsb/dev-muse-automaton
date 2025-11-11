package handler

import (
	"chatbot-automation/internal/service"
	"github.com/gofiber/fiber/v2"
)

// DebounceHandler handles debounced AI message processing requests from Deno Deploy
type DebounceHandler struct {
	debounceService *service.DebounceService
}

// NewDebounceHandler creates a new debounce handler
func NewDebounceHandler(debounceService *service.DebounceService) *DebounceHandler {
	return &DebounceHandler{
		debounceService: debounceService,
	}
}

// ProcessDebouncedMessages handles the debounced message processing
// Called by Deno Deploy after 30-second debounce period
func (h *DebounceHandler) ProcessDebouncedMessages(c *fiber.Ctx) error {
	// Parse request body
	type ProcessRequest struct {
		DeviceID string   `json:"device_id"`
		Phone    string   `json:"phone"`
		Name     string   `json:"name"`
		Messages []string `json:"messages"` // Array of messages to combine
	}

	var req ProcessRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request body",
		})
	}

	// Validate
	if req.DeviceID == "" || req.Phone == "" || len(req.Messages) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "device_id, phone, and messages are required",
		})
	}

	// Process messages with AI and send response
	err := h.debounceService.ProcessAndRespond(c.Context(), req.DeviceID, req.Phone, req.Name, req.Messages)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Messages processed and response sent",
	})
}
