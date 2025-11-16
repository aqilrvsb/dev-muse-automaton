package repository

import (
	"chatbot-automation/internal/database"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// AnalyticsRepository handles analytics data operations
type AnalyticsRepository struct {
	db *database.SupabaseClient
}

// NewAnalyticsRepository creates a new analytics repository
func NewAnalyticsRepository(db *database.SupabaseClient) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

// GetConversationMetrics retrieves conversation analytics
func (r *AnalyticsRepository) GetConversationMetrics(ctx context.Context, deviceID string, timeRange *models.TimeRangeFilter) (*models.ConversationMetrics, error) {
	params := map[string]string{
		"select": "*",
	}

	if deviceID != "" {
		params["id_device"] = fmt.Sprintf("eq.%s", deviceID)
	}

	if timeRange != nil {
		params["created_at"] = fmt.Sprintf("gte.%s", timeRange.StartDate.Format(time.RFC3339))
		params["created_at"] = fmt.Sprintf("lte.%s", timeRange.EndDate.Format(time.RFC3339))
	}

	data, err := r.db.QueryAsAdmin("ai_whatsapp", params)
	if err != nil {
		return nil, fmt.Errorf("failed to query conversations: %w", err)
	}

	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse conversations: %w", err)
	}

	// Calculate metrics
	metrics := &models.ConversationMetrics{
		TotalConversations:      len(conversations),
		ConversationsByStage:    make(map[string]int),
		ConversationsByNiche:    make(map[string]int),
		ConversationsByStatus:   make(map[string]int),
		DailyConversationCounts: make([]models.DailyConversationCount, 0),
	}

	var totalCompletionTime float64
	completedCount := 0
	dailyCounts := make(map[string]int)

	for _, conv := range conversations {
		// Count by execution status (using ExecutionStatus field instead of Status)
		status := "active"
		if conv.ExecutionStatus != nil && *conv.ExecutionStatus != "" {
			status = *conv.ExecutionStatus
		}

		if status == "active" {
			metrics.ActiveConversations++
		} else if status == "completed" {
			metrics.CompletedConversations++
		} else if status == "abandoned" {
			metrics.AbandonedConversations++
		}

		metrics.ConversationsByStatus[status]++

		// Count by stage
		// NULL stage means the conversation is at "Welcome Message" stage
		if conv.Stage != nil {
			metrics.ConversationsByStage[*conv.Stage]++
		} else {
			metrics.ConversationsByStage["Welcome Message"]++
		}

		// Count by niche
		if conv.Niche != nil {
			metrics.ConversationsByNiche[*conv.Niche]++
		}

		// Calculate completion time (using UpdatedAt - CreatedAt as approximation)
		if status == "completed" && conv.UpdatedAt != nil && conv.CreatedAt != nil {
			duration := conv.UpdatedAt.Sub(*conv.CreatedAt).Seconds()
			totalCompletionTime += duration
			completedCount++
		}

		// Daily counts
		if conv.CreatedAt != nil {
			dateKey := conv.CreatedAt.Format("2006-01-02")
			dailyCounts[dateKey]++
		}
	}

	// Calculate average completion time
	if completedCount > 0 {
		metrics.AverageCompletionTime = totalCompletionTime / float64(completedCount)
	}

	// Convert daily counts to array
	for date, count := range dailyCounts {
		metrics.DailyConversationCounts = append(metrics.DailyConversationCounts, models.DailyConversationCount{
			Date:  date,
			Count: count,
		})
	}

	return metrics, nil
}

// GetFlowMetrics retrieves flow-specific analytics
func (r *AnalyticsRepository) GetFlowMetrics(ctx context.Context, flowID string, timeRange *models.TimeRangeFilter) (*models.FlowMetrics, error) {
	// Get flow details
	flowData, err := r.db.QueryAsAdmin("chatbot_flows", map[string]string{
		"select": "*",
		"id":     fmt.Sprintf("eq.%s", flowID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query flow: %w", err)
	}

	var flows []models.ChatbotFlow
	if err := json.Unmarshal(flowData, &flows); err != nil || len(flows) == 0 {
		return nil, fmt.Errorf("flow not found")
	}

	flow := flows[0]

	// Get conversations for this flow
	params := map[string]string{
		"select":  "*",
		"flow_id": fmt.Sprintf("eq.%s", flowID),
	}

	if timeRange != nil {
		params["created_at"] = fmt.Sprintf("gte.%s", timeRange.StartDate.Format(time.RFC3339))
	}

	convData, err := r.db.QueryAsAdmin("ai_whatsapp", params)
	if err != nil {
		return nil, fmt.Errorf("failed to query conversations: %w", err)
	}

	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(convData, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse conversations: %w", err)
	}

	metrics := &models.FlowMetrics{
		FlowID:      flowID,
		FlowName:    flow.Name,
		NodeMetrics: make(map[string]models.NodeMetric),
	}

	metrics.TotalExecutions = len(conversations)

	var totalCompletionTime float64
	for _, conv := range conversations {
		status := "active"
		if conv.ExecutionStatus != nil && *conv.ExecutionStatus != "" {
			status = *conv.ExecutionStatus
		}

		if status == "completed" {
			metrics.CompletedExecutions++
			if conv.UpdatedAt != nil && conv.CreatedAt != nil {
				duration := conv.UpdatedAt.Sub(*conv.CreatedAt).Seconds()
				totalCompletionTime += duration
			}
		} else if status == "abandoned" {
			metrics.AbandonedExecutions++
		}
	}

	// Calculate completion rate
	if metrics.TotalExecutions > 0 {
		metrics.CompletionRate = (float64(metrics.CompletedExecutions) / float64(metrics.TotalExecutions)) * 100
	}

	// Calculate average completion time
	if metrics.CompletedExecutions > 0 {
		metrics.AverageCompletionTime = totalCompletionTime / float64(metrics.CompletedExecutions)
	}

	return metrics, nil
}

// GetDeviceMetrics retrieves device-specific analytics
func (r *AnalyticsRepository) GetDeviceMetrics(ctx context.Context, userID string) ([]models.DeviceMetrics, error) {
	// Get user's devices
	devicesData, err := r.db.QueryAsAdmin("device_setting", map[string]string{
		"select":  "*",
		"user_id": fmt.Sprintf("eq.%s", userID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query devices: %w", err)
	}

	var devices []models.DeviceSetting
	if err := json.Unmarshal(devicesData, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse devices: %w", err)
	}

	deviceMetrics := make([]models.DeviceMetrics, 0)

	for _, device := range devices {
		deviceID := device.ID
		if device.IDDevice != nil {
			deviceID = *device.IDDevice
		}

		// Get conversations for this device
		convData, err := r.db.QueryAsAdmin("ai_whatsapp", map[string]string{
			"select":    "*",
			"id_device": fmt.Sprintf("eq.%s", deviceID),
		})
		if err != nil {
			continue
		}

		var conversations []models.AIWhatsapp
		if err := json.Unmarshal(convData, &conversations); err != nil {
			continue
		}

		metrics := models.DeviceMetrics{
			DeviceID:           deviceID,
			DeviceName:         deviceID,
			TotalConversations: len(conversations),
		}

		activeCount := 0
		for _, conv := range conversations {
			status := "active"
			if conv.ExecutionStatus != nil && *conv.ExecutionStatus != "" {
				status = *conv.ExecutionStatus
			}
			if status == "active" {
				activeCount++
			}
		}
		metrics.ActiveConversations = activeCount

		// Calculate response rate (prospects who responded at least once)
		if len(conversations) > 0 {
			respondedCount := 0
			for _, conv := range conversations {
				// Check if conv_last has any data (user has sent at least one message)
				if conv.ConvLast != nil && *conv.ConvLast != "" {
					respondedCount++
				}
			}
			metrics.ResponseRate = (float64(respondedCount) / float64(len(conversations))) * 100
		}

		deviceMetrics = append(deviceMetrics, metrics)
	}

	return deviceMetrics, nil
}

// GetMessageMetrics retrieves message-level analytics
func (r *AnalyticsRepository) GetMessageMetrics(ctx context.Context, deviceID string, timeRange *models.TimeRangeFilter) (*models.MessageMetrics, error) {
	params := map[string]string{
		"select": "*",
	}

	if deviceID != "" {
		params["id_device"] = fmt.Sprintf("eq.%s", deviceID)
	}

	if timeRange != nil {
		params["created_at"] = fmt.Sprintf("gte.%s", timeRange.StartDate.Format(time.RFC3339))
	}

	data, err := r.db.QueryAsAdmin("ai_whatsapp", params)
	if err != nil {
		return nil, fmt.Errorf("failed to query conversations: %w", err)
	}

	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse conversations: %w", err)
	}

	metrics := &models.MessageMetrics{
		MessagesByType: make(map[string]int),
	}

	totalMessages := 0
	for _, conv := range conversations {
		// Parse conv_last format: "User: message\nBot: reply"
		if conv.ConvLast != nil && *conv.ConvLast != "" {
			lines := strings.Split(*conv.ConvLast, "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}
				totalMessages++
				if strings.HasPrefix(line, "User:") {
					metrics.TotalMessagesReceived++
				} else if strings.HasPrefix(line, "Bot:") {
					metrics.TotalMessagesSent++
				}
			}
		}
	}

	if len(conversations) > 0 {
		metrics.AverageMessagesPerConversation = float64(totalMessages) / float64(len(conversations))
	}

	// Default message type distribution
	metrics.MessagesByType["text"] = metrics.TotalMessagesSent

	return metrics, nil
}
