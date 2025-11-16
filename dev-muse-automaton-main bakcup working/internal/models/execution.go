package models

import "time"

// NodeType represents different types of flow nodes
type NodeType string

const (
	NodeTypeStart     NodeType = "start"
	NodeTypeMessage   NodeType = "message"
	NodeTypeImage     NodeType = "image"
	NodeTypeAudio     NodeType = "audio"
	NodeTypeVideo     NodeType = "video"
	NodeTypeDocument  NodeType = "document"
	NodeTypeAI        NodeType = "ai"
	NodeTypeCondition NodeType = "condition"
	NodeTypeDelay     NodeType = "delay"
	NodeTypeStage     NodeType = "stage"
	NodeTypePrompt    NodeType = "prompt"
	NodeTypeUserReply NodeType = "user_reply"
	NodeTypeEnd       NodeType = "end"
	NodeTypeAPI       NodeType = "api"
)

// FlowNode represents a node in the chatbot flow
type FlowNode struct {
	ID       string                 `json:"id"`
	Type     NodeType               `json:"type"`
	Data     map[string]interface{} `json:"data"`
	Position map[string]float64     `json:"position,omitempty"`
}

// FlowEdge represents a connection between nodes
type FlowEdge struct {
	ID          string `json:"id"`
	Source      string `json:"source"`
	Target      string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"`
	TargetHandle string `json:"targetHandle,omitempty"`
	Label       string `json:"label,omitempty"`
}

// ExecutionContext holds the state during flow execution
type ExecutionContext struct {
	ConversationID string                 `json:"conversation_id"`
	DeviceID       string                 `json:"device_id"`
	ProspectNum    string                 `json:"prospect_num"`
	CurrentNodeID  string                 `json:"current_node_id"`
	Variables      map[string]interface{} `json:"variables"`
	FlowID         string                 `json:"flow_id"`
	UserMessage    string                 `json:"user_message,omitempty"`
	LastResponse   string                 `json:"last_response,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

// ExecutionResult represents the result of executing a flow node
type ExecutionResult struct {
	Success       bool                   `json:"success"`
	Message       string                 `json:"message"`
	NextNodeID    string                 `json:"next_node_id,omitempty"`
	Response      string                 `json:"response,omitempty"`
	ShouldReply   bool                   `json:"should_reply"`
	Variables     map[string]interface{} `json:"variables,omitempty"`
	Error         string                 `json:"error,omitempty"`
	DelaySeconds  int                    `json:"delay_seconds,omitempty"`
	CompletedFlow bool                   `json:"completed_flow"`
}

// ProcessNodeRequest represents a request to process a specific node
type ProcessNodeRequest struct {
	ConversationID string                 `json:"conversation_id"`
	NodeID         string                 `json:"node_id"`
	UserMessage    string                 `json:"user_message,omitempty"`
	Variables      map[string]interface{} `json:"variables,omitempty"`
}

// ProcessNodeResponse represents the response from processing a node
type ProcessNodeResponse struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Result  *ExecutionResult `json:"result,omitempty"`
	Error   string           `json:"error,omitempty"`
}

// WebhookRequest represents an incoming webhook from WhatsApp provider
type WebhookRequest struct {
	Provider string                 `json:"provider"`
	DeviceID string                 `json:"device_id"`
	Event    string                 `json:"event"`
	From     string                 `json:"from"`
	Body     string                 `json:"body"`
	Type     string                 `json:"type"`
	Raw      map[string]interface{} `json:"raw"`
}

// WebhookResponse represents the response to a webhook
type WebhookResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Processed bool   `json:"processed"`
	Error     string `json:"error,omitempty"`
}

// StartFlowRequest represents a request to start a flow execution
type StartFlowRequest struct {
	DeviceID    string `json:"device_id" validate:"required"`
	ProspectNum string `json:"prospect_num" validate:"required"`
	FlowID      string `json:"flow_id"`
}

// StartFlowResponse represents the response from starting a flow
type StartFlowResponse struct {
	Success        bool   `json:"success"`
	Message        string `json:"message"`
	ConversationID string `json:"conversation_id,omitempty"`
	Error          string `json:"error,omitempty"`
}

// ResumeFlowRequest represents a request to resume a paused flow
type ResumeFlowRequest struct {
	ConversationID string `json:"conversation_id" validate:"required"`
	UserMessage    string `json:"user_message,omitempty"`
}

// ResumeFlowResponse represents the response from resuming a flow
type ResumeFlowResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// NodeProcessor is an interface for processing different node types
type NodeProcessor interface {
	ProcessNode(ctx *ExecutionContext, node *FlowNode, edges []FlowEdge) (*ExecutionResult, error)
	GetNodeType() NodeType
}
