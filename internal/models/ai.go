package models

import "time"

// AIProvider represents the AI service provider
type AIProvider string

const (
	AIProviderOpenAI    AIProvider = "openai"
	AIProviderAnthropic AIProvider = "anthropic"
)

// AIModel represents available AI models
type AIModel string

const (
	// OpenAI models
	ModelGPT4        AIModel = "gpt-4"
	ModelGPT4Turbo   AIModel = "gpt-4-turbo-preview"
	ModelGPT35Turbo  AIModel = "gpt-3.5-turbo"

	// Anthropic models
	ModelClaude3Opus   AIModel = "claude-3-opus-20240229"
	ModelClaude3Sonnet AIModel = "claude-3-sonnet-20240229"
	ModelClaude3Haiku  AIModel = "claude-3-haiku-20240307"
)

// AIMessage represents a message in the conversation
type AIMessage struct {
	Role    string `json:"role" validate:"required,oneof=user assistant system"`
	Content string `json:"content" validate:"required"`
}

// AICompletionRequest represents a request to generate AI completion
type AICompletionRequest struct {
	Provider     AIProvider   `json:"provider" validate:"required,oneof=openai anthropic"`
	Model        AIModel      `json:"model" validate:"required"`
	Messages     []AIMessage  `json:"messages" validate:"required,min=1,dive"`
	Temperature  *float64     `json:"temperature,omitempty"`
	MaxTokens    *int         `json:"max_tokens,omitempty"`
	SystemPrompt *string      `json:"system_prompt,omitempty"`
	DeviceID     string       `json:"device_id" validate:"required"`
}

// AICompletionResponse represents the AI completion response
type AICompletionResponse struct {
	Success      bool        `json:"success"`
	Message      string      `json:"message"`
	Content      string      `json:"content,omitempty"`
	Provider     AIProvider  `json:"provider,omitempty"`
	Model        AIModel     `json:"model,omitempty"`
	Usage        *TokenUsage `json:"usage,omitempty"`
	Error        string      `json:"error,omitempty"`
}

// TokenUsage represents token usage statistics
type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// AIConfig represents AI configuration for a device
type AIConfig struct {
	ID               string     `json:"id"`
	DeviceID         string     `json:"device_id"`
	Provider         AIProvider `json:"provider"`
	Model            AIModel    `json:"model"`
	APIKey           string     `json:"api_key"`
	Temperature      *float64   `json:"temperature,omitempty"`
	MaxTokens        *int       `json:"max_tokens,omitempty"`
	SystemPrompt     *string    `json:"system_prompt,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// CreateAIConfigRequest represents a request to create AI configuration
type CreateAIConfigRequest struct {
	DeviceID     string     `json:"device_id" validate:"required"`
	Provider     AIProvider `json:"provider" validate:"required,oneof=openai anthropic"`
	Model        AIModel    `json:"model" validate:"required"`
	APIKey       string     `json:"api_key" validate:"required"`
	Temperature  *float64   `json:"temperature,omitempty"`
	MaxTokens    *int       `json:"max_tokens,omitempty"`
	SystemPrompt *string    `json:"system_prompt,omitempty"`
}

// UpdateAIConfigRequest represents a request to update AI configuration
type UpdateAIConfigRequest struct {
	Provider     *AIProvider `json:"provider,omitempty"`
	Model        *AIModel    `json:"model,omitempty"`
	APIKey       *string     `json:"api_key,omitempty"`
	Temperature  *float64    `json:"temperature,omitempty"`
	MaxTokens    *int        `json:"max_tokens,omitempty"`
	SystemPrompt *string     `json:"system_prompt,omitempty"`
}

// AIConfigResponse represents the response for AI config operations
type AIConfigResponse struct {
	Success bool      `json:"success"`
	Message string    `json:"message"`
	Config  *AIConfig `json:"config,omitempty"`
	Error   string    `json:"error,omitempty"`
}

// ChatRequest represents a simplified chat request
type ChatRequest struct {
	DeviceID string `json:"device_id" validate:"required"`
	Message  string `json:"message" validate:"required"`
	Context  []AIMessage `json:"context,omitempty"`
}

// ChatResponse represents the chat response
type ChatResponse struct {
	Success  bool        `json:"success"`
	Message  string      `json:"message"`
	Response string      `json:"response,omitempty"`
	Usage    *TokenUsage `json:"usage,omitempty"`
	Error    string      `json:"error,omitempty"`
}
