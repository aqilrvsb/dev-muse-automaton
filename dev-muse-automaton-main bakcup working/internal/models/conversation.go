package models

import "time"

// AIWhatsapp represents a WhatsApp conversation with a prospect (Chatbot AI)
type AIWhatsapp struct {
	IDProspect      *int       `json:"id_prospect,omitempty"`
	Number          *string    `json:"number,omitempty"`
	IDDevice        string     `json:"id_device"`
	Niche           *string    `json:"niche,omitempty"`
	ProspectName    *string    `json:"prospect_name,omitempty"`
	ProspectNum     string     `json:"prospect_num"`
	Intro           *string    `json:"intro,omitempty"`
	Stage           *string    `json:"stage,omitempty"`
	ConvLast        *string    `json:"conv_last,omitempty"` // Stores "User: message\nBot: reply"
	ConvCurrent     *string    `json:"conv_current,omitempty"`
	ExecutionStatus *string    `json:"execution_status,omitempty"`
	FlowID          *string    `json:"flow_id,omitempty"`
	CurrentNodeID   *string    `json:"current_node_id,omitempty"`
	LastNodeID      *string    `json:"last_node_id,omitempty"`
	WaitingForReply *bool      `json:"waiting_for_reply,omitempty"`
	Balas           *string    `json:"balas,omitempty"`
	Human           *int       `json:"human,omitempty"`
	KeywordIklan    *string    `json:"keywordiklan,omitempty"`
	Marketer        *string    `json:"marketer,omitempty"`
	CreatedAt       *time.Time `json:"created_at,omitempty"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
}

// Wasapbot represents a WhatsApp conversation with a prospect (WhatsApp Bot - without AI Prompt)
type Wasapbot struct {
	IDProspect       *int       `json:"id_prospect,omitempty"`
	Number           *string    `json:"number,omitempty"`
	IDDevice         string     `json:"id_device"`
	Niche            *string    `json:"niche,omitempty"`
	ProspectName     *string    `json:"prospect_name,omitempty"`
	ProspectNum      string     `json:"prospect_num"`
	Intro            *string    `json:"intro,omitempty"`
	Stage            *string    `json:"stage,omitempty"`
	ConvLast         *string    `json:"conv_last,omitempty"`    // Stores "User: message\nBot: reply"
	ConvCurrent      *string    `json:"conv_current,omitempty"` // Previously conv_start
	ExecutionStatus  *string    `json:"execution_status,omitempty"`
	FlowID           *string    `json:"flow_id,omitempty"`
	CurrentNodeID    *string    `json:"current_node_id,omitempty"`
	LastNodeID       *string    `json:"last_node_id,omitempty"`
	WaitingForReply  *bool      `json:"waiting_for_reply,omitempty"`
	Balas            *string    `json:"balas,omitempty"`
	Human            *int       `json:"human,omitempty"`
	KeywordIklan     *string    `json:"keywordiklan,omitempty"`
	Marketer         *string    `json:"marketer,omitempty"`
	PeringkatSekolah *string    `json:"peringkat_sekolah,omitempty"` // School level for customer
	Alamat           *string    `json:"alamat,omitempty"`             // Customer address
	Pakej            *string    `json:"pakej,omitempty"`              // Package selected
	NoFon            *string    `json:"no_fon,omitempty"`             // Phone number
	CaraBayaran      *string    `json:"cara_bayaran,omitempty"`       // Payment method
	TarikhGaji       *string    `json:"tarikh_gaji,omitempty"`        // Salary date
	CreatedAt        *time.Time `json:"created_at,omitempty"`         // Database column: created_at (previously date_start)
	UpdatedAt        *time.Time `json:"updated_at,omitempty"`         // Database column: updated_at (previously updated_at)
}

// CreateConversationRequest is the request body for creating a conversation
type CreateConversationRequest struct {
	ProspectNum string  `json:"prospect_num" validate:"required"`
	IDDevice    string  `json:"id_device" validate:"required"`
	Stage       *string `json:"stage,omitempty"`
	Niche       *string `json:"niche,omitempty"`
	FlowID      *string `json:"flow_id,omitempty"`
}

// UpdateConversationRequest is the request body for updating a conversation
type UpdateConversationRequest struct {
	Stage               *string                 `json:"stage,omitempty"`
	Niche               *string                 `json:"niche,omitempty"`
	ConversationHistory *map[string]interface{} `json:"conversation_history,omitempty"`
	IsActive            *bool                   `json:"is_active,omitempty"`
	FlowID              *string                 `json:"flow_id,omitempty"`
	CurrentNode         *string                 `json:"current_node,omitempty"`
	SessionData         *map[string]interface{} `json:"session_data,omitempty"`
	Status              *string                 `json:"status,omitempty"` // active, completed, abandoned
}

// AddMessageRequest is the request body for adding a message to conversation history
type AddMessageRequest struct {
	Role    string `json:"role" validate:"required,oneof=user assistant system"`
	Content string `json:"content" validate:"required"`
}

// ConversationResponse is the response for conversation operations
type ConversationResponse struct {
	Success      bool           `json:"success"`
	Message      string         `json:"message"`
	Conversation *AIWhatsapp    `json:"conversation,omitempty"`
	Conversations []AIWhatsapp  `json:"conversations,omitempty"`
}

// WasapbotResponse is the response for wasapbot operations
type WasapbotResponse struct {
	Success       bool        `json:"success"`
	Message       string      `json:"message"`
	Conversation  *Wasapbot   `json:"conversation,omitempty"`
	Conversations []Wasapbot  `json:"conversations,omitempty"`
}

// ConversationStats represents conversation statistics
type ConversationStats struct {
	TotalConversations     int            `json:"total_conversations"`
	ActiveConversations    int            `json:"active_conversations"`
	CompletedConversations int            `json:"completed_conversations"`
	AbandonedConversations int            `json:"abandoned_conversations"`
	ByStage                map[string]int `json:"by_stage"`
	ByNiche                map[string]int `json:"by_niche"`
	ByDevice               map[string]int `json:"by_device"`
}
