package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"
	"context"
	"log"

	"github.com/gofiber/fiber/v2"
)

// WebhookHandler handles webhook requests from WhatsApp providers
type WebhookHandler struct {
	flowExecutionService *service.FlowExecutionService
	deviceService        *service.DeviceService
	whatsappService      *service.WhatsAppService
	flowProcessor        *service.FlowProcessorService
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(flowExecutionService *service.FlowExecutionService, deviceService *service.DeviceService, whatsappService *service.WhatsAppService, flowProcessor *service.FlowProcessorService) *WebhookHandler {
	return &WebhookHandler{
		flowExecutionService: flowExecutionService,
		deviceService:        deviceService,
		whatsappService:      whatsappService,
		flowProcessor:        flowProcessor,
	}
}

// HandleWhatsAppWebhook handles incoming webhooks from WhatsApp providers
// POST /api/webhook/whatsapp/:deviceId
func (h *WebhookHandler) HandleWhatsAppWebhook(c *fiber.Ctx) error {
	deviceID := c.Params("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	// Parse webhook payload
	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		log.Printf("❌ Failed to parse webhook payload: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid webhook payload",
			"error":   err.Error(),
		})
	}

	log.Printf("📥 Webhook received for device %s: %+v", deviceID, payload)

	// Extract message data
	event, _ := payload["event"].(string)
	from, _ := payload["from"].(string)
	body, _ := payload["body"].(string)
	messageType, _ := payload["type"].(string)

	// Skip if not a message event
	if event != "message" && event != "messages.upsert" {
		log.Printf("⏭️  Skipping non-message event: %s", event)
		return c.JSON(fiber.Map{
			"success":   true,
			"message":   "Event ignored",
			"processed": false,
		})
	}

	// Skip if empty message
	if body == "" {
		log.Printf("⏭️  Skipping empty message")
		return c.JSON(fiber.Map{
			"success":   true,
			"message":   "Empty message ignored",
			"processed": false,
		})
	}

	// Skip if not text message
	if messageType != "" && messageType != "text" {
		log.Printf("⏭️  Skipping non-text message type: %s", messageType)
		return c.JSON(fiber.Map{
			"success":   true,
			"message":   "Non-text message ignored",
			"processed": false,
		})
	}

	// Clean phone number (remove @c.us, @s.whatsapp.net, etc.)
	from = h.cleanPhoneNumber(from)

	log.Printf("✅ Processing message from %s: %s", from, body)

	// Process the message through flow execution
	result, err := h.flowExecutionService.ProcessMessage(c.Context(), from, body)
	if err != nil {
		log.Printf("❌ Failed to process message: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to process message",
			"error":   err.Error(),
		})
	}

	log.Printf("✅ Message processed successfully: %+v", result)

	// Send reply if needed
	if result.ShouldReply && result.Response != "" {
		// Check if media is included in variables
		mediaType := ""
		mediaURL := ""
		if result.Variables != nil {
			if mt, ok := result.Variables["_media_type"].(string); ok {
				mediaType = mt
			}
			if mu, ok := result.Variables["_media_url"].(string); ok {
				mediaURL = mu
			}
		}

		// Send message via WhatsApp
		if err := h.whatsappService.SendMessage(c.Context(), deviceID, from, result.Response, mediaType, mediaURL); err != nil {
			log.Printf("⚠️  Failed to send WhatsApp reply: %v", err)
			// Don't fail the webhook - just log the error
		} else {
			log.Printf("📤 Sent reply to %s: %s", from, result.Response)
		}
	}

	return c.JSON(fiber.Map{
		"success":   true,
		"message":   "Webhook processed successfully",
		"processed": true,
		"result":    result,
	})
}

// HandleWahaWebhook handles webhooks from Waha provider
// POST /api/webhook/waha/:deviceId
func (h *WebhookHandler) HandleWahaWebhook(c *fiber.Ctx) error {
	deviceID := c.Params("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid webhook payload",
		})
	}

	log.Printf("📥 Waha webhook for device %s: %+v", deviceID, payload)

	// Waha-specific parsing
	event, _ := payload["event"].(string)

	var from, body string
	if payloadData, ok := payload["payload"].(map[string]interface{}); ok {
		from, _ = payloadData["from"].(string)
		body, _ = payloadData["body"].(string)
	}

	if event != "message" || body == "" {
		return c.JSON(fiber.Map{
			"success":   true,
			"processed": false,
		})
	}

	from = h.cleanPhoneNumber(from)

	result, err := h.flowExecutionService.ProcessMessage(c.Context(), from, body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success":   true,
		"processed": true,
		"result":    result,
	})
}

// HandleWablasWebhook handles webhooks from Wablas provider
// POST /api/webhook/wablas/:deviceId
func (h *WebhookHandler) HandleWablasWebhook(c *fiber.Ctx) error {
	deviceID := c.Params("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid webhook payload",
		})
	}

	log.Printf("📥 Wablas webhook for device %s: %+v", deviceID, payload)

	// Wablas-specific parsing
	from, _ := payload["phone"].(string)
	body, _ := payload["message"].(string)

	if body == "" {
		return c.JSON(fiber.Map{
			"success":   true,
			"processed": false,
		})
	}

	from = h.cleanPhoneNumber(from)

	result, err := h.flowExecutionService.ProcessMessage(c.Context(), from, body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success":   true,
		"processed": true,
		"result":    result,
	})
}

// HandleWhacenterWebhook handles webhooks from Whacenter provider
// POST /api/webhook/whacenter/:deviceId
func (h *WebhookHandler) HandleWhacenterWebhook(c *fiber.Ctx) error {
	deviceID := c.Params("deviceId")
	if deviceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Device ID is required",
		})
	}

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid webhook payload",
		})
	}

	log.Printf("📥 Whacenter webhook for device %s: %+v", deviceID, payload)

	// Whacenter-specific parsing
	event, _ := payload["event"].(string)
	from, _ := payload["from"].(string)

	// Whacenter can use "message" or "body"
	body, _ := payload["message"].(string)
	if body == "" {
		body, _ = payload["body"].(string)
	}

	if event != "message" || body == "" {
		return c.JSON(fiber.Map{
			"success":   true,
			"processed": false,
		})
	}

	from = h.cleanPhoneNumber(from)

	result, err := h.flowExecutionService.ProcessMessage(c.Context(), from, body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success":   true,
		"processed": true,
		"result":    result,
	})
}

// StartFlow manually starts a flow for a prospect
// POST /api/webhook/start-flow
func (h *WebhookHandler) StartFlow(c *fiber.Ctx) error {
	// This endpoint allows manual flow start (useful for testing)
	var req models.StartFlowRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// For webhook endpoint, we skip authentication
	// In production, you might want to add API key authentication
	result, err := h.flowExecutionService.StartFlow(c.Context(), "webhook-user", &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(result)
}

// cleanPhoneNumber removes WhatsApp-specific suffixes from phone numbers
func (h *WebhookHandler) cleanPhoneNumber(phone string) string {
	// Remove common WhatsApp suffixes
	phone = stripSuffix(phone, "@c.us")
	phone = stripSuffix(phone, "@s.whatsapp.net")
	phone = stripSuffix(phone, "@g.us")

	return phone
}

// stripSuffix removes a suffix from a string if present
func stripSuffix(s, suffix string) string {
	if len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix {
		return s[:len(s)-len(suffix)]
	}
	return s
}

// ReceiveWebhook handles incoming webhook messages using webhook_id
// POST /api/webhook/:webhook_id
func (h *WebhookHandler) ReceiveWebhook(c *fiber.Ctx) error {
	// Get webhook_id from URL parameter
	webhookID := c.Params("webhook_id")
	if webhookID == "" {
		log.Printf("❌ Missing webhook_id in request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "webhook_id is required",
		})
	}

	log.Printf("📥 Received webhook for ID: %s", webhookID)

	// Get raw body for logging
	rawBody := string(c.Body())
	log.Printf("📦 RAW WEBHOOK BODY: %s", rawBody)

	// Parse incoming webhook data
	var webhookData map[string]interface{}
	if err := c.BodyParser(&webhookData); err != nil {
		log.Printf("❌ Failed to parse webhook body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "invalid request body",
		})
	}

	log.Printf("📦 Webhook data received: %d fields", len(webhookData))
	log.Printf("📦 PARSED WEBHOOK DATA: %+v", webhookData)

	// Process the message asynchronously with background context
	// Note: Cannot use c.Context() as it becomes invalid after response is sent
	go func() {
		ctx := context.Background()
		err := h.flowProcessor.ProcessIncomingMessage(ctx, webhookID, webhookData)
		if err != nil {
			log.Printf("❌ Failed to process webhook message: %v", err)
		}
	}()

	// Return immediate success response
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"message": "webhook received",
	})
}
