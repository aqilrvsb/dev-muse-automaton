package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// DebounceService handles debounced message processing
type DebounceService struct {
	deviceRepo       *repository.DeviceRepository
	conversationRepo *repository.ConversationRepository
	whatsappService  *WhatsAppService
	aiService        *AIService
}

// NewDebounceService creates a new debounce service
func NewDebounceService(
	deviceRepo *repository.DeviceRepository,
	conversationRepo *repository.ConversationRepository,
	whatsappService *WhatsAppService,
	aiService *AIService,
) *DebounceService {
	return &DebounceService{
		deviceRepo:       deviceRepo,
		conversationRepo: conversationRepo,
		whatsappService:  whatsappService,
		aiService:        aiService,
	}
}

// ProcessAndRespond processes debounced messages with AI and sends response
func (s *DebounceService) ProcessAndRespond(ctx context.Context, deviceID string, phone string, name string, messages []string) error {
	// 1. Get device configuration
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, deviceID)
	if err != nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, deviceID)
		if err != nil {
			return fmt.Errorf("device not found: %w", err)
		}
	}

	if device == nil {
		return fmt.Errorf("device not found")
	}

	// 2. Get or create conversation record for history
	conversation, err := s.conversationRepo.GetConversationByPhoneAndDevice(ctx, phone, deviceID)
	if err != nil {
		// If no conversation exists, create one
		conversation = &models.AIWhatsapp{
			IDDevice:    deviceID,
			ProspectNum: phone,
		}
		if name != "" {
			conversation.ProspectName = &name
		}
	}

	// 3. Combine multiple messages into one
	combinedMessage := strings.Join(messages, "\n\n")

	// 4. Parse conversation history from conv_last field
	conversationHistory := []models.AIMessage{}
	if conversation.ConvLast != nil && *conversation.ConvLast != "" {
		// Parse "User: message\nBot: reply" format
		conversationHistory = parseConversationHistory(*conversation.ConvLast)
	}

	// 5. Add new user message to history
	conversationHistory = append(conversationHistory, models.AIMessage{
		Role:    "user",
		Content: combinedMessage,
	})

	// 6. Determine AI provider and model from device settings
	provider := models.AIProviderOpenAI
	model := models.ModelGPT35Turbo
	apiKey := ""

	if device.APIKeyOption != "" {
		// Parse API key option (e.g., "openai/gpt-4", "anthropic/claude-3")
		parts := strings.Split(device.APIKeyOption, "/")
		if len(parts) >= 2 {
			switch strings.ToLower(parts[0]) {
			case "openai":
				provider = models.AIProviderOpenAI
				model = models.AIModel(parts[1]) // e.g., "gpt-4", "gpt-3.5-turbo"
			case "anthropic":
				provider = models.AIProviderAnthropic
				model = models.AIModel(parts[1]) // e.g., "claude-3-opus-20240229"
			}
		}
	}

	// Get API key from device
	if device.APIKey != nil && *device.APIKey != "" {
		apiKey = *device.APIKey
	}

	// Get system prompt/intro from device (DeviceSetting doesn't have Intro, use nil for now)
	var systemPrompt *string
	// TODO: Check if there's a system prompt field in device settings

	// 7. Call AI to generate response
	aiResponse, err := s.callAI(ctx, provider, model, apiKey, conversationHistory, systemPrompt)
	if err != nil {
		return fmt.Errorf("AI processing failed: %w", err)
	}

	// 8. Add AI response to conversation history
	conversationHistory = append(conversationHistory, models.AIMessage{
		Role:    "assistant",
		Content: aiResponse,
	})

	// 9. Update conversation record with new history
	newConvLast := formatConversationHistory(conversationHistory)
	conversation.ConvLast = &newConvLast
	conversation.ConvCurrent = &combinedMessage

	// Save conversation to database
	if conversation.IDProspect == nil {
		// Create new conversation
		err = s.conversationRepo.CreateConversation(ctx, conversation)
	} else {
		// Update existing conversation
		err = s.conversationRepo.UpdateConversationModel(ctx, *conversation.IDProspect, conversation)
	}

	if err != nil {
		// Log error but don't fail the whole operation
		fmt.Printf("Warning: Failed to save conversation history: %v\n", err)
	}

	// 10. Send WhatsApp response using existing WhatsAppService
	err = s.whatsappService.SendMessage(ctx, deviceID, phone, aiResponse, "", "")
	if err != nil {
		return fmt.Errorf("failed to send WhatsApp message: %w", err)
	}

	return nil
}

// callAI calls the AI service to generate a response
func (s *DebounceService) callAI(ctx context.Context, provider models.AIProvider, model models.AIModel, apiKey string, messages []models.AIMessage, systemPrompt *string) (string, error) {
	// Build AI completion request
	req := &models.AICompletionRequest{
		Provider:     provider,
		Model:        model,
		Messages:     messages,
		SystemPrompt: systemPrompt,
		DeviceID:     apiKey, // Temporarily use DeviceID field to pass API key
	}

	// Create a temporary user ID (since we're not using user-based auth in webhook context)
	// The AI service will skip user validation since we're using device-based lookup
	userID := "system"

	// Call the public GenerateCompletion method
	result, err := s.aiService.GenerateCompletion(ctx, userID, req)
	if err != nil {
		return "", fmt.Errorf("AI generation failed: %w", err)
	}

	if !result.Success {
		return "", fmt.Errorf("AI API error: %s - %s", result.Message, result.Error)
	}

	return result.Content, nil
}

// parseConversationHistory parses "User: message\nBot: reply" format
func parseConversationHistory(convLast string) []models.AIMessage {
	messages := []models.AIMessage{}

	// Try to parse as JSON first
	var jsonMessages []models.AIMessage
	if err := json.Unmarshal([]byte(convLast), &jsonMessages); err == nil {
		return jsonMessages
	}

	// Fallback: Parse simple text format
	lines := strings.Split(convLast, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "User: ") {
			messages = append(messages, models.AIMessage{
				Role:    "user",
				Content: strings.TrimPrefix(line, "User: "),
			})
		} else if strings.HasPrefix(line, "Bot: ") {
			messages = append(messages, models.AIMessage{
				Role:    "assistant",
				Content: strings.TrimPrefix(line, "Bot: "),
			})
		}
	}

	return messages
}

// formatConversationHistory formats messages as JSON for storage
func formatConversationHistory(messages []models.AIMessage) string {
	// Store as JSON for better parsing
	data, err := json.Marshal(messages)
	if err != nil {
		// Fallback to simple text format
		var result strings.Builder
		for _, msg := range messages {
			if msg.Role == "user" {
				result.WriteString("User: ")
			} else if msg.Role == "assistant" {
				result.WriteString("Bot: ")
			}
			result.WriteString(msg.Content)
			result.WriteString("\n")
		}
		return result.String()
	}
	return string(data)
}
