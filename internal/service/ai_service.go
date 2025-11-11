package service

import (
	"bytes"
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AIService handles AI-related operations
type AIService struct {
	deviceRepo *repository.DeviceRepository
	client     *http.Client
}

// NewAIService creates a new AI service
func NewAIService(deviceRepo *repository.DeviceRepository) *AIService {
	return &AIService{
		deviceRepo: deviceRepo,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// GenerateCompletion generates AI completion using specified provider
func (s *AIService) GenerateCompletion(ctx context.Context, userID string, req *models.AICompletionRequest) (*models.AICompletionResponse, error) {
	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, req.DeviceID)
	if err != nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, req.DeviceID)
		if err != nil {
			return &models.AICompletionResponse{
				Success: false,
				Message: "Device not found",
			}, nil
		}
	}

	if device == nil || device.UserID == nil || *device.UserID != userID {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Access denied: device not found or unauthorized",
		}, nil
	}

	// Route to appropriate provider
	switch req.Provider {
	case models.AIProviderOpenAI:
		return s.generateOpenAICompletion(ctx, req)
	case models.AIProviderAnthropic:
		return s.generateAnthropicCompletion(ctx, req)
	default:
		return &models.AICompletionResponse{
			Success: false,
			Message: "Unsupported AI provider",
			Error:   fmt.Sprintf("Provider '%s' is not supported", req.Provider),
		}, nil
	}
}

// generateOpenAICompletion generates completion using OpenAI API
func (s *AIService) generateOpenAICompletion(ctx context.Context, req *models.AICompletionRequest) (*models.AICompletionResponse, error) {
	// Get API key from device settings (assume stored in device metadata)
	// For now, we'll require it to be passed in the request or environment
	apiKey := req.DeviceID // Placeholder - should come from device settings

	// Build OpenAI API request
	url := "https://api.openai.com/v1/chat/completions"

	// Prepare messages
	messages := make([]map[string]string, 0)

	// Add system prompt if provided
	if req.SystemPrompt != nil && *req.SystemPrompt != "" {
		messages = append(messages, map[string]string{
			"role":    "system",
			"content": *req.SystemPrompt,
		})
	}

	// Add conversation messages
	for _, msg := range req.Messages {
		messages = append(messages, map[string]string{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}

	// Build request payload
	payload := map[string]interface{}{
		"model":    req.Model,
		"messages": messages,
	}

	// Add optional parameters
	if req.Temperature != nil {
		payload["temperature"] = *req.Temperature
	}
	if req.MaxTokens != nil {
		payload["max_tokens"] = *req.MaxTokens
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to prepare request",
			Error:   err.Error(),
		}, nil
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to create request",
			Error:   err.Error(),
		}, nil
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	// Send request
	resp, err := s.client.Do(httpReq)
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to send request",
			Error:   err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to read response",
			Error:   err.Error(),
		}, nil
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return &models.AICompletionResponse{
			Success: false,
			Message: "OpenAI API error",
			Error:   string(body),
		}, nil
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to parse response",
			Error:   err.Error(),
		}, nil
	}

	// Extract content
	content := ""
	if choices, ok := result["choices"].([]interface{}); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := choice["message"].(map[string]interface{}); ok {
				if contentStr, ok := message["content"].(string); ok {
					content = contentStr
				}
			}
		}
	}

	// Extract usage
	var usage *models.TokenUsage
	if usageData, ok := result["usage"].(map[string]interface{}); ok {
		usage = &models.TokenUsage{}
		if promptTokens, ok := usageData["prompt_tokens"].(float64); ok {
			usage.PromptTokens = int(promptTokens)
		}
		if completionTokens, ok := usageData["completion_tokens"].(float64); ok {
			usage.CompletionTokens = int(completionTokens)
		}
		if totalTokens, ok := usageData["total_tokens"].(float64); ok {
			usage.TotalTokens = int(totalTokens)
		}
	}

	return &models.AICompletionResponse{
		Success:  true,
		Message:  "Completion generated successfully",
		Content:  content,
		Provider: req.Provider,
		Model:    req.Model,
		Usage:    usage,
	}, nil
}

// generateAnthropicCompletion generates completion using Anthropic API
func (s *AIService) generateAnthropicCompletion(ctx context.Context, req *models.AICompletionRequest) (*models.AICompletionResponse, error) {
	// Get API key from device settings
	apiKey := req.DeviceID // Placeholder - should come from device settings

	// Build Anthropic API request
	url := "https://api.anthropic.com/v1/messages"

	// Prepare messages (Anthropic format)
	messages := make([]map[string]string, 0)
	for _, msg := range req.Messages {
		// Anthropic doesn't support system role in messages array
		if msg.Role != "system" {
			messages = append(messages, map[string]string{
				"role":    msg.Role,
				"content": msg.Content,
			})
		}
	}

	// Build request payload
	payload := map[string]interface{}{
		"model":      req.Model,
		"messages":   messages,
		"max_tokens": 1024, // Default
	}

	// Add system prompt if provided (Anthropic uses separate field)
	if req.SystemPrompt != nil && *req.SystemPrompt != "" {
		payload["system"] = *req.SystemPrompt
	}

	// Add optional parameters
	if req.Temperature != nil {
		payload["temperature"] = *req.Temperature
	}
	if req.MaxTokens != nil {
		payload["max_tokens"] = *req.MaxTokens
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to prepare request",
			Error:   err.Error(),
		}, nil
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to create request",
			Error:   err.Error(),
		}, nil
	}

	// Set headers (Anthropic-specific)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	// Send request
	resp, err := s.client.Do(httpReq)
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to send request",
			Error:   err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to read response",
			Error:   err.Error(),
		}, nil
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Anthropic API error",
			Error:   string(body),
		}, nil
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return &models.AICompletionResponse{
			Success: false,
			Message: "Failed to parse response",
			Error:   err.Error(),
		}, nil
	}

	// Extract content
	content := ""
	if contentArray, ok := result["content"].([]interface{}); ok && len(contentArray) > 0 {
		if contentBlock, ok := contentArray[0].(map[string]interface{}); ok {
			if text, ok := contentBlock["text"].(string); ok {
				content = text
			}
		}
	}

	// Extract usage
	var usage *models.TokenUsage
	if usageData, ok := result["usage"].(map[string]interface{}); ok {
		usage = &models.TokenUsage{}
		if inputTokens, ok := usageData["input_tokens"].(float64); ok {
			usage.PromptTokens = int(inputTokens)
		}
		if outputTokens, ok := usageData["output_tokens"].(float64); ok {
			usage.CompletionTokens = int(outputTokens)
		}
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}

	return &models.AICompletionResponse{
		Success:  true,
		Message:  "Completion generated successfully",
		Content:  content,
		Provider: req.Provider,
		Model:    req.Model,
		Usage:    usage,
	}, nil
}

// SimpleChat provides a simplified chat interface
func (s *AIService) SimpleChat(ctx context.Context, userID string, req *models.ChatRequest) (*models.ChatResponse, error) {
	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, req.DeviceID)
	if err != nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, req.DeviceID)
		if err != nil {
			return &models.ChatResponse{
				Success: false,
				Message: "Device not found",
			}, nil
		}
	}

	if device == nil || device.UserID == nil || *device.UserID != userID {
		return &models.ChatResponse{
			Success: false,
			Message: "Access denied: device not found or unauthorized",
		}, nil
	}

	// Build messages from context + new message
	messages := make([]models.AIMessage, 0)
	if req.Context != nil {
		messages = append(messages, req.Context...)
	}
	messages = append(messages, models.AIMessage{
		Role:    "user",
		Content: req.Message,
	})

	// Use GPT-3.5-turbo as default for simple chat
	completionReq := &models.AICompletionRequest{
		Provider: models.AIProviderOpenAI,
		Model:    models.ModelGPT35Turbo,
		Messages: messages,
		DeviceID: req.DeviceID,
	}

	// Generate completion
	completion, err := s.GenerateCompletion(ctx, userID, completionReq)
	if err != nil {
		return &models.ChatResponse{
			Success: false,
			Message: "Failed to generate response",
			Error:   err.Error(),
		}, nil
	}

	if !completion.Success {
		return &models.ChatResponse{
			Success: false,
			Message: completion.Message,
			Error:   completion.Error,
		}, nil
	}

	return &models.ChatResponse{
		Success:  true,
		Message:  "Response generated successfully",
		Response: completion.Content,
		Usage:    completion.Usage,
	}, nil
}
