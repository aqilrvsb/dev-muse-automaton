package handler

import (
	"bytes"
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

// WebhookHandler handles webhook requests from WhatsApp providers
type WebhookHandler struct {
	flowExecutionService *service.FlowExecutionService
	deviceService        *service.DeviceService
	whatsappService      *service.WhatsAppService
	flowProcessor        *service.FlowProcessorService
	webhookService       *service.WebhookService
	deviceRepo           interface {
		GetDeviceByWebhookID(ctx context.Context, webhookID string) (*models.DeviceSetting, error)
		GetDeviceByIDDevice(ctx context.Context, idDevice string) (*models.DeviceSetting, error)
	}
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(flowExecutionService *service.FlowExecutionService, deviceService *service.DeviceService, whatsappService *service.WhatsAppService, flowProcessor *service.FlowProcessorService, webhookService *service.WebhookService, deviceRepo interface {
	GetDeviceByWebhookID(ctx context.Context, webhookID string) (*models.DeviceSetting, error)
	GetDeviceByIDDevice(ctx context.Context, idDevice string) (*models.DeviceSetting, error)
}) *WebhookHandler {
	return &WebhookHandler{
		flowExecutionService: flowExecutionService,
		deviceService:        deviceService,
		whatsappService:      whatsappService,
		flowProcessor:        flowProcessor,
		webhookService:       webhookService,
		deviceRepo:           deviceRepo,
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

	// Forward to Deno Deploy for debouncing instead of processing immediately
	// Note: This webhook doesn't extract pushName, so pass empty string
	err := h.forwardToDeno(deviceID, from, body, "")
	if err != nil {
		log.Printf("⚠️  Failed to forward to Deno (falling back to direct processing): %v", err)

		// Fallback: Process directly if Deno fails
		result, err := h.flowExecutionService.ProcessMessage(c.Context(), from, body)
		if err != nil {
			log.Printf("❌ Failed to process message: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "Failed to process message",
				"error":   err.Error(),
			})
		}

		// Send reply if needed
		if result.ShouldReply && result.Response != "" {
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

			if err := h.whatsappService.SendMessage(c.Context(), deviceID, from, result.Response, mediaType, mediaURL); err != nil {
				log.Printf("⚠️  Failed to send WhatsApp reply: %v", err)
			} else {
				log.Printf("📤 Sent reply to %s: %s", from, result.Response)
			}
		}

		return c.JSON(fiber.Map{
			"success":   true,
			"message":   "Processed directly (Deno unavailable)",
			"processed": true,
			"result":    result,
		})
	}

	log.Printf("✅ Message forwarded to Deno for debouncing")

	return c.JSON(fiber.Map{
		"success":   true,
		"message":   "Message queued for debouncing",
		"processed": false,
		"debounced": true,
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

// HandleDebouncedMessages processes debounced messages from Deno Deploy
// POST /api/debounce/process
func (h *WebhookHandler) HandleDebouncedMessages(c *fiber.Ctx) error {
	// Parse request from Deno Deploy
	var req struct {
		DeviceID string   `json:"device_id"`
		Phone    string   `json:"phone"`
		Name     string   `json:"name"`
		Messages []string `json:"messages"`
	}

	if err := c.BodyParser(&req); err != nil {
		log.Printf("❌ Failed to parse debounced message request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	log.Printf("🔄 [DEBOUNCED] Received %d messages from %s (device: %s)", len(req.Messages), req.Phone, req.DeviceID)

	if len(req.Messages) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "No messages to process",
		})
	}

	// Combine all messages with newlines
	combinedMessage := ""
	for i, msg := range req.Messages {
		if i > 0 {
			combinedMessage += "\n"
		}
		combinedMessage += msg
	}

	log.Printf("💬 Combined message: %s", combinedMessage)

	// NEW: Use FlowProcessorService to handle flow-based webhooks
	// Reconstruct the webhook data for processing
	webhookData := map[string]interface{}{
		"from":         req.Phone,
		"phone":        req.Phone,
		"message":      combinedMessage,
		"pushName":     req.Name,
		"message_type": "text",
		"is_group":     false,
	}

	// Process through flow processor (async to prevent timeout)
	go func() {
		ctx := context.Background()
		err := h.flowProcessor.ProcessIncomingMessage(ctx, req.DeviceID, webhookData)
		if err != nil {
			log.Printf("❌ Failed to process debounced messages via FlowProcessor: %v", err)
		} else {
			log.Printf("✅ Debounced messages processed successfully via FlowProcessor")
		}
	}()

	log.Printf("✅ Debounced messages queued for processing")

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Messages processed and response sent",
		"result": fiber.Map{
			"success":        true,
			"message":        "Processing via FlowProcessor",
			"should_reply":   true,
			"completed_flow": false,
		},
	})
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

	// NEW: Extract message data and forward to Deno Deploy for debouncing
	// Step 1: Get device by webhook_id or id_device
	device, err := h.deviceRepo.GetDeviceByWebhookID(c.Context(), webhookID)
	if err != nil || device == nil {
		log.Printf("🔍 Device not found by webhook_id, trying id_device: %s", webhookID)
		device, err = h.deviceRepo.GetDeviceByIDDevice(c.Context(), webhookID)
		if err != nil || device == nil {
			log.Printf("⚠️  Device not found, falling back to direct processing")
			// Fallback to direct processing without Deno
			go func() {
				ctx := context.Background()
				err := h.flowProcessor.ProcessIncomingMessage(ctx, webhookID, webhookData)
				if err != nil {
					log.Printf("❌ Failed to process webhook message: %v", err)
				}
			}()
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"success": true,
				"message": "webhook received (device not found, direct processing)",
			})
		}
	}

	// Step 2: Detect provider
	provider := device.Provider
	if provider == "" || provider == "waha" {
		// Auto-detect from webhook structure
		if _, hasPayload := webhookData["payload"]; hasPayload {
			if _, hasSession := webhookData["session"]; hasSession {
				provider = "waha"
				log.Printf("🔍 Detected Waha webhook from data structure")
			}
		}
	}
	if provider == "" {
		provider = "whacenter" // Default to Whacenter
	}

	log.Printf("✅ Found device: %s (Provider: %s)", webhookID, provider)

	// Step 3: Extract message data based on provider
	idDevice := ""
	if device.IDDevice != nil {
		idDevice = *device.IDDevice
	}

	extractedMsg, err := h.webhookService.ExtractMessageData(c.Context(), webhookData, idDevice, provider)
	if err != nil {
		log.Printf("⚠️  Failed to extract message data: %v, falling back to direct processing", err)
		// Fallback to direct processing
		go func() {
			ctx := context.Background()
			err := h.flowProcessor.ProcessIncomingMessage(ctx, webhookID, webhookData)
			if err != nil {
				log.Printf("❌ Failed to process webhook message: %v", err)
			}
		}()
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": "webhook received (extraction failed, direct processing)",
		})
	}

	log.Printf("✅ Extracted message: phone=%s, message=%s, name=%s", extractedMsg.PhoneNumber, extractedMsg.Message, extractedMsg.Name)

	// Step 4: Forward to Deno Deploy for debouncing
	err = h.forwardToDeno(extractedMsg.DeviceID, extractedMsg.PhoneNumber, extractedMsg.Message, extractedMsg.Name)
	if err != nil {
		log.Printf("⚠️  Failed to forward to Deno (falling back to direct processing): %v", err)
		// Fallback to direct processing
		go func() {
			ctx := context.Background()
			err := h.flowProcessor.ProcessIncomingMessage(ctx, webhookID, webhookData)
			if err != nil {
				log.Printf("❌ Failed to process webhook message: %v", err)
			}
		}()
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"success": true,
			"message": "webhook received (Deno unavailable, direct processing)",
		})
	}

	log.Printf("✅ Message forwarded to Deno for debouncing")

	// Return immediate success response
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success":   true,
		"message":   "webhook received and queued for debouncing",
		"debounced": true,
	})
}

// forwardToDeno forwards extracted message data to Deno Deploy for debouncing
func (h *WebhookHandler) forwardToDeno(deviceID, phone, message, name string) error {
	// NEW: Use /queue endpoint instead of /webhook
	denoURL := "https://chatbot-debouncer.deno.dev/queue"

	// NEW: Updated payload format matching Deno Deploy's expected structure
	payload := map[string]interface{}{
		"device_id": deviceID, // Changed from "deviceId"
		"phone":     phone,
		"message":   message,
		"name":      name, // Include user's name from extracted data
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	resp, err := http.Post(denoURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to send to Deno: %w", err)
	}
	defer resp.Body.Close()

	// Read response body for logging
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Deno returned %d: %s", resp.StatusCode, string(body))
	}

	// Parse response to check if message was queued or ignored
	var denoResp map[string]interface{}
	if err := json.Unmarshal(body, &denoResp); err == nil {
		if queued, ok := denoResp["queued"].(bool); ok && !queued {
			// Message was ignored (processing/cooldown)
			reason, _ := denoResp["reason"].(string)
			log.Printf("⏭️  Deno ignored message (reason: %s): device=%s, phone=%s", reason, deviceID, phone)
		} else {
			// Message was queued
			queueSize, _ := denoResp["queueSize"].(float64)
			log.Printf("📮 Forwarded to Deno (queue size: %.0f): device=%s, phone=%s", queueSize, deviceID, phone)
		}
	}

	return nil
}
