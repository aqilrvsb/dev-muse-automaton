package service

import (
	"context"
	"fmt"
	"log"
	"strings"

	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
)

type FlowProcessorService struct {
	webhookService   *WebhookService
	whatsappService  *WhatsAppService
	flowRepo         *repository.FlowRepository
	deviceRepo       *repository.DeviceRepository
	convRepo         *repository.ConversationRepository
	wasapbotRepo     *repository.WasapbotRepository
	stageRepo        *repository.StageRepository
}

func NewFlowProcessorService(
	webhookService *WebhookService,
	whatsappService *WhatsAppService,
	flowRepo *repository.FlowRepository,
	deviceRepo *repository.DeviceRepository,
	convRepo *repository.ConversationRepository,
	wasapbotRepo *repository.WasapbotRepository,
	stageRepo *repository.StageRepository,
) *FlowProcessorService {
	return &FlowProcessorService{
		webhookService:  webhookService,
		whatsappService: whatsappService,
		flowRepo:        flowRepo,
		deviceRepo:      deviceRepo,
		convRepo:        convRepo,
		wasapbotRepo:    wasapbotRepo,
		stageRepo:       stageRepo,
	}
}

// Helper function to safely get string from pointer
func getStringValue(ptr *string) string {
	if ptr == nil {
		return ""
	}
	return *ptr
}

// determineFlowType determines if flow is for Whatsapp Bot or Chatbot AI
// Based on niche or flow name patterns
func (s *FlowProcessorService) determineFlowType(flow *models.ChatbotFlow) string {
	// Check if niche or name contains "ai" or "chatbot"
	niche := strings.ToLower(flow.Niche)
	name := strings.ToLower(flow.Name)

	if strings.Contains(niche, "ai") || strings.Contains(name, "ai") ||
		strings.Contains(niche, "chatbot") || strings.Contains(name, "chatbot") {
		return "Chatbot AI"
	}

	// Default to Whatsapp Bot
	return "Whatsapp Bot"
}

// ProcessIncomingMessage processes an incoming webhook message
func (s *FlowProcessorService) ProcessIncomingMessage(ctx context.Context, webhookID string, rawData map[string]interface{}) error {
	log.Printf("📨 Processing incoming message for webhook ID: %s", webhookID)

	// Step 1: Get device by webhook_id, if not found try id_device
	device, err := s.deviceRepo.GetDeviceByWebhookID(ctx, webhookID)
	if err != nil {
		log.Printf("⚠️  Error getting device by webhook_id: %v", err)
	}

	// If not found by webhook_id, try by id_device
	if device == nil {
		log.Printf("🔍 Device not found by webhook_id, trying id_device: %s", webhookID)
		device, err = s.deviceRepo.GetDeviceByIDDevice(ctx, webhookID)
		if err != nil {
			log.Printf("⚠️  Error getting device by id_device: %v", err)
		}
	}

	if device == nil {
		return fmt.Errorf("device not found for webhook ID or id_device: %s", webhookID)
	}

	idDevice := getStringValue(device.IDDevice)

	// Detect provider from webhook data if needed
	provider := device.Provider
	if provider == "" || provider == "waha" {
		// Check if this is a Waha webhook structure
		if _, hasPayload := rawData["payload"]; hasPayload {
			if _, hasSession := rawData["session"]; hasSession {
				provider = "waha"
				log.Printf("🔍 Detected Waha webhook from data structure")
			}
		}
	}

	log.Printf("✅ Found device: %s (Provider: %s)", idDevice, provider)

	// Step 2: Extract message data based on provider
	extractedMsg, err := s.webhookService.ExtractMessageData(ctx, rawData, idDevice, provider)
	if err != nil {
		log.Printf("⚠️  Message extraction failed: %v", err)
		return nil // Don't return error for group messages or invalid numbers
	}

	log.Printf("✅ Extracted message from %s: %s", extractedMsg.PhoneNumber, extractedMsg.Message)

	// Step 3: Get flow by id_device (not device.ID which is UUID)
	log.Printf("🔍 Looking for flows with id_device: %s", idDevice)
	flows, err := s.flowRepo.GetFlowsByDeviceID(ctx, idDevice)
	if err != nil {
		log.Printf("❌ Error getting flows: %v", err)
		return fmt.Errorf("failed to get flows for device: %w", err)
	}

	if len(flows) == 0 {
		log.Printf("⚠️  No flows found for id_device: %s", idDevice)
		return nil // No flows configured, skip processing
	}

	log.Printf("✅ Found %d flow(s) for device", len(flows))

	// Use the first active flow
	flow := flows[0]
	flowType := s.determineFlowType(&flow)
	log.Printf("✅ Found flow: %s (Type: %s)", flow.Name, flowType)

	// Step 4: Validate flow has nodes and edges
	if flow.Nodes == nil || len(flow.Nodes) == 0 {
		log.Printf("⚠️  Flow %s has no nodes configured", flow.Name)
		return nil // No nodes, skip processing
	}

	if flow.Edges == nil || len(flow.Edges) == 0 {
		log.Printf("⚠️  Flow %s has no edges configured", flow.Name)
		return nil // No edges, skip processing
	}

	log.Printf("✅ Flow validated: %d nodes, %d edges", len(flow.Nodes), len(flow.Edges))

	// Step 5: Determine which table to use based on flow data type
	var contactExists bool
	var contactID string
	var currentStage string

	if flowType == "Whatsapp Bot" {
		// Use wasapbot table
		log.Printf("📋 Using Whatsapp Bot flow - checking wasapbot table")
		contact, err := s.convRepo.GetWasapBotContact(ctx, idDevice, extractedMsg.PhoneNumber, flow.Niche)
		if err != nil {
			return fmt.Errorf("failed to check wasapbot contact: %w", err)
		}

		if contact == nil {
			// Create new contact
			log.Printf("➕ Creating new wasapbot contact")
			prospectName := extractedMsg.Name
			status := "Prospek"
			executionStatus := "active"
			flowIDStr := flow.ID
			// Create conv_last with initial message (Chatbot AI format)
			convLast := fmt.Sprintf("User: %s", extractedMsg.Message)

			newContact := &models.WasapBot{
				DeviceID:        idDevice,
				ProspectNum:     extractedMsg.PhoneNumber,
				Niche:           &flow.Niche,
				Stage:           nil, // NULL initially, only set when Stage node is found
				ProspectName:    &prospectName,
				Status:          &status,
				FlowID:          &flowIDStr,
				ExecutionStatus: &executionStatus,
				CurrentNodeID:   nil, // Will be set during flow execution
				ConvLast:        &convLast,
			}

			err = s.convRepo.CreateWasapBotContact(ctx, newContact)
			if err != nil {
				return fmt.Errorf("failed to create wasapbot contact: %w", err)
			}

			contactID = fmt.Sprintf("%d", *newContact.IDProspect)
			currentStage = "" // Empty initially since Stage is NULL
			contactExists = false
			log.Printf("✅ Created new wasapbot contact: %s", contactID)
		} else {
			// Contact exists
			contactID = fmt.Sprintf("%d", *contact.IDProspect)
			if contact.Stage != nil {
				currentStage = *contact.Stage
			}
			contactExists = true
			log.Printf("✅ Found existing wasapbot contact: %s (Stage: %s)", contactID, currentStage)

			// Check if waiting for reply
			if contact.WaitingForReply != nil && *contact.WaitingForReply {
				log.Printf("▶️  Resuming flow from waiting state")

				// Append user message to existing conv_last
				existingConvLast := ""
				if contact.ConvLast != nil {
					existingConvLast = *contact.ConvLast
				}
				newConvLast := existingConvLast + fmt.Sprintf("\nUser: %s", extractedMsg.Message)

				// Get current node ID for resume
				currentNodeID := ""
				if contact.CurrentNodeID != nil {
					currentNodeID = *contact.CurrentNodeID
				}

				// Update conv_last and reset waiting state
				updates := map[string]interface{}{
					"conv_last":         newConvLast,
					"waiting_for_reply": false,
				}
				_ = s.convRepo.UpdateWasapBotContact(ctx, contactID, updates)

				// Resume flow from current node
				wasapbotEngine := NewWasapbotFlowEngine(s.deviceRepo, s.wasapbotRepo, s.stageRepo, s.whatsappService)
				err = wasapbotEngine.ResumeWasapbotFlow(ctx, &flow, contactID, extractedMsg.Message, currentNodeID)
				if err != nil {
					log.Printf("❌ Wasapbot flow resume error: %v", err)
					return fmt.Errorf("failed to resume wasapbot flow: %w", err)
				}

				log.Printf("✅ Wasapbot flow resumed and completed")
				return nil
			}

			// Not waiting for reply - update conv_last with new message
			updates := map[string]interface{}{
				"conv_last": fmt.Sprintf("User: %s", extractedMsg.Message),
			}
			_ = s.convRepo.UpdateWasapBotContact(ctx, contactID, updates)
		}

		// Execute Whatsapp Bot flow and return early
		// Don't run the Chatbot AI state-checking code below
		log.Printf("🔄 Executing flow for contact %s at stage: %s", contactID, currentStage)
		log.Printf("📊 Contact exists: %v, New contact: %v", contactExists, !contactExists)

		// Create wasapbot flow engine and execute
		wasapbotEngine := NewWasapbotFlowEngine(s.deviceRepo, s.wasapbotRepo, s.stageRepo, s.whatsappService)
		err = wasapbotEngine.ExecuteWasapbotFlow(ctx, &flow, contactID, extractedMsg.Message, currentStage)
		if err != nil {
			log.Printf("❌ Wasapbot flow execution error: %v", err)
			return fmt.Errorf("failed to execute wasapbot flow: %w", err)
		}

		log.Printf("✅ Wasapbot flow execution completed")
		return nil // Return early - don't run Chatbot AI code

	} else if flowType == "Chatbot AI" {
		// Use ai_whatsapp table
		log.Printf("🤖 Using Chatbot AI flow - checking ai_whatsapp table")
		conversation, err := s.convRepo.GetConversationByProspectNum(ctx, extractedMsg.PhoneNumber, idDevice)
		if err != nil {
			return fmt.Errorf("failed to check ai_whatsapp contact: %w", err)
		}

		if conversation == nil {
			// Create new conversation
			log.Printf("➕ Creating new ai_whatsapp conversation")
			executionStatus := "active"
			newConv := &models.AIWhatsapp{
				IDDevice:        idDevice,
				ProspectNum:     extractedMsg.PhoneNumber,
				ExecutionStatus: &executionStatus,
				FlowID:          &flow.ID, // Save chatbot_flows id
			}

			// Set prospect name if available
			if extractedMsg.Name != "" {
				newConv.ProspectName = &extractedMsg.Name
			}

			// Set niche if available
			if flow.Niche != "" {
				newConv.Niche = &flow.Niche
			}

			// Stage is left as NULL on initial insert (no default value)

			// Initialize conv_last with user message
			// Format: "User: message\nBot: reply"
			convLast := fmt.Sprintf("User: %s", extractedMsg.Message)
			newConv.ConvLast = &convLast

			err = s.convRepo.CreateConversation(ctx, newConv)
			if err != nil {
				return fmt.Errorf("failed to create ai_whatsapp conversation: %w", err)
			}

			contactID = fmt.Sprintf("%d", *newConv.IDProspect) // Convert int to string
			currentStage = ""                                       // Stage is null initially
			contactExists = false
			log.Printf("✅ Created new ai_whatsapp conversation: %s", contactID)
		} else {
			// Conversation exists
			contactID = fmt.Sprintf("%d", *conversation.IDProspect) // Convert int to string
			if conversation.Stage != nil {
				currentStage = *conversation.Stage
			} else {
				currentStage = "" // Stage can be null
			}
			contactExists = true
			log.Printf("✅ Found existing ai_whatsapp conversation: %s (Stage: %s)", contactID, currentStage)

			// Update last interaction
			_ = s.convRepo.UpdateLastInteraction(ctx, contactID)
		}
	} else {
		return fmt.Errorf("unsupported flow type: %s", flowType)
	}

	// Step 6: Check execution status and waiting state
	conversation, err := s.convRepo.GetConversationByID(ctx, contactID)
	if err != nil {
		log.Printf("❌ Failed to get conversation: %v", err)
		return fmt.Errorf("failed to get conversation: %w", err)
	}

	// Check if flow already completed
	if conversation.ExecutionStatus != nil && *conversation.ExecutionStatus == "completed" {
		log.Printf("⏹️  Flow already completed for contact %s, ignoring message", contactID)
		return nil
	}

	// Check if waiting for reply
	if conversation.WaitingForReply != nil && *conversation.WaitingForReply {
		log.Printf("▶️  Resuming flow from waiting state for contact %s", contactID)

		// Get current node ID
		currentNodeID := ""
		if conversation.CurrentNodeID != nil {
			currentNodeID = *conversation.CurrentNodeID
		}

		// Reset waiting state
		updates := map[string]interface{}{
			"waiting_for_reply": false,
		}
		_ = s.convRepo.UpdateConversation(ctx, contactID, updates)

		// Resume flow from current node
		err = s.ResumeFlow(ctx, &flow, contactID, extractedMsg.Message, currentNodeID)
	} else {
		// Start flow from beginning
		log.Printf("🔄 Executing flow for contact %s at stage: %s", contactID, currentStage)
		log.Printf("📊 Contact exists: %v, New contact: %v", contactExists, !contactExists)

		err = s.ExecuteFlow(ctx, &flow, contactID, extractedMsg.Message, currentStage)
	}

	if err != nil {
		log.Printf("❌ Flow execution error: %v", err)
		return fmt.Errorf("failed to execute flow: %w", err)
	}

	log.Printf("✅ Flow execution completed successfully for contact: %s", contactID)
	return nil
}
