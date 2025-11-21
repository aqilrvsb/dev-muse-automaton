package models

import "time"

// ChatbotFlow represents a chatbot conversation flow
type ChatbotFlow struct {
	ID        string                 `json:"id"`
	IDDevice  string                 `json:"id_device"`
	Name      string                 `json:"name"`
	Niche     string                 `json:"niche"`
	NodesData string                 `json:"nodes_data"` // JSON string containing complete flow structure
	Nodes     map[string]interface{} `json:"nodes,omitempty"` // JSONB - React Flow nodes
	Edges     map[string]interface{} `json:"edges,omitempty"` // JSONB - React Flow edges
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

// CreateFlowRequest is the request body for creating a flow
type CreateFlowRequest struct {
	IDDevice  string `json:"id_device" validate:"required"`
	FlowName  string `json:"flow_name" validate:"required"`
	Niche     string `json:"niche"`
	NodesData string `json:"nodes_data"` // JSON string containing complete flow structure
}

// UpdateFlowRequest is the request body for updating a flow
type UpdateFlowRequest struct {
	FlowName  *string `json:"flow_name,omitempty"`
	Niche     *string `json:"niche,omitempty"`
	NodesData *string `json:"nodes_data,omitempty"`
}

// FlowResponse is the response for flow operations
type FlowResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Flow    *ChatbotFlow    `json:"flow,omitempty"`
	Flows   []ChatbotFlow   `json:"flows,omitempty"`
}
