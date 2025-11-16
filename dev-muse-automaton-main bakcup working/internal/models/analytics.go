package models

import "time"

// ConversationMetrics represents conversation-level analytics
type ConversationMetrics struct {
	TotalConversations      int                        `json:"total_conversations"`
	ActiveConversations     int                        `json:"active_conversations"`
	CompletedConversations  int                        `json:"completed_conversations"`
	AbandonedConversations  int                        `json:"abandoned_conversations"`
	AverageCompletionTime   float64                    `json:"average_completion_time"` // in seconds
	ConversationsByStage    map[string]int             `json:"conversations_by_stage"`
	ConversationsByNiche    map[string]int             `json:"conversations_by_niche"`
	ConversationsByStatus   map[string]int             `json:"conversations_by_status"`
	DailyConversationCounts []DailyConversationCount   `json:"daily_conversation_counts"`
}

// DailyConversationCount represents conversation counts per day
type DailyConversationCount struct {
	Date  string `json:"date"`  // YYYY-MM-DD
	Count int    `json:"count"`
}

// FlowMetrics represents flow-level analytics
type FlowMetrics struct {
	FlowID              string             `json:"flow_id"`
	FlowName            string             `json:"flow_name"`
	TotalExecutions     int                `json:"total_executions"`
	CompletedExecutions int                `json:"completed_executions"`
	AbandonedExecutions int                `json:"abandoned_executions"`
	CompletionRate      float64            `json:"completion_rate"` // percentage
	AverageCompletionTime float64          `json:"average_completion_time"` // in seconds
	NodeMetrics         map[string]NodeMetric `json:"node_metrics"`
}

// NodeMetric represents metrics for individual nodes
type NodeMetric struct {
	NodeID        string  `json:"node_id"`
	NodeType      string  `json:"node_type"`
	VisitCount    int     `json:"visit_count"`
	AverageTime   float64 `json:"average_time"` // time spent on this node
	DropOffRate   float64 `json:"drop_off_rate"` // percentage who abandon at this node
}

// DeviceMetrics represents device-level analytics
type DeviceMetrics struct {
	DeviceID            string  `json:"device_id"`
	DeviceName          string  `json:"device_name"`
	TotalConversations  int     `json:"total_conversations"`
	ActiveConversations int     `json:"active_conversations"`
	ResponseRate        float64 `json:"response_rate"` // percentage of prospects who respond
	AverageResponseTime float64 `json:"average_response_time"` // in seconds
}

// MessageMetrics represents message-level analytics
type MessageMetrics struct {
	TotalMessagesSent     int            `json:"total_messages_sent"`
	TotalMessagesReceived int            `json:"total_messages_received"`
	MessagesByType        map[string]int `json:"messages_by_type"` // text, image, audio, etc.
	AverageMessagesPerConversation float64 `json:"average_messages_per_conversation"`
}

// AIMetrics represents AI usage analytics
type AIMetrics struct {
	TotalAIRequests     int            `json:"total_ai_requests"`
	AIRequestsByProvider map[string]int `json:"ai_requests_by_provider"` // openai, anthropic
	AIRequestsByModel    map[string]int `json:"ai_requests_by_model"`
	TotalTokensUsed      int            `json:"total_tokens_used"`
	AverageResponseTime  float64        `json:"average_response_time"` // in seconds
}

// TimeRangeFilter represents a time range for filtering analytics
type TimeRangeFilter struct {
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

// AnalyticsRequest represents a request for analytics data
type AnalyticsRequest struct {
	DeviceID  string           `json:"device_id,omitempty"`
	FlowID    string           `json:"flow_id,omitempty"`
	TimeRange *TimeRangeFilter `json:"time_range,omitempty"`
	GroupBy   string           `json:"group_by,omitempty"` // day, week, month
}

// DashboardMetrics represents overall dashboard metrics
type DashboardMetrics struct {
	Conversations *ConversationMetrics `json:"conversations"`
	Devices       []DeviceMetrics      `json:"devices"`
	Messages      *MessageMetrics      `json:"messages"`
	AI            *AIMetrics           `json:"ai,omitempty"`
	TimeRange     *TimeRangeFilter     `json:"time_range"`
}

// AnalyticsResponse represents the response for analytics requests
type AnalyticsResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    *DashboardMetrics `json:"data,omitempty"`
	Error   string            `json:"error,omitempty"`
}

// FlowAnalyticsResponse represents flow-specific analytics response
type FlowAnalyticsResponse struct {
	Success bool         `json:"success"`
	Message string       `json:"message"`
	Data    *FlowMetrics `json:"data,omitempty"`
	Error   string       `json:"error,omitempty"`
}

// ConversationAnalyticsResponse represents conversation analytics response
type ConversationAnalyticsResponse struct {
	Success bool                  `json:"success"`
	Message string                `json:"message"`
	Data    *ConversationMetrics  `json:"data,omitempty"`
	Error   string                `json:"error,omitempty"`
}

// ExportRequest represents a request to export analytics data
type ExportRequest struct {
	DeviceID  string           `json:"device_id,omitempty"`
	FlowID    string           `json:"flow_id,omitempty"`
	TimeRange *TimeRangeFilter `json:"time_range,omitempty"`
	Format    string           `json:"format"` // csv, json, xlsx
}

// ExportResponse represents the response for export requests
type ExportResponse struct {
	Success  bool   `json:"success"`
	Message  string `json:"message"`
	FileURL  string `json:"file_url,omitempty"`
	FileName string `json:"file_name,omitempty"`
	Error    string `json:"error,omitempty"`
}
