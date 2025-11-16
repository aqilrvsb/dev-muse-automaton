package repository

import (
	"chatbot-automation/internal/database"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// FlowRepository handles flow data operations
type FlowRepository struct {
	supabase *database.SupabaseClient
}

// NewFlowRepository creates a new flow repository
func NewFlowRepository(supabase *database.SupabaseClient) *FlowRepository {
	return &FlowRepository{
		supabase: supabase,
	}
}

// CreateFlow creates a new flow
func (r *FlowRepository) CreateFlow(ctx context.Context, flow *models.ChatbotFlow) error {
	// Generate UUID for new flow
	flow.ID = uuid.New().String()
	flow.CreatedAt = time.Now()
	flow.UpdatedAt = time.Now()

	// Insert using service role (bypasses RLS)
	data, err := r.supabase.InsertAsAdmin("chatbot_flows", flow)
	if err != nil {
		return fmt.Errorf("failed to create flow: %w", err)
	}

	// Parse response to get created flow
	var flows []models.ChatbotFlow
	if err := json.Unmarshal(data, &flows); err != nil {
		return fmt.Errorf("failed to parse created flow: %w", err)
	}

	if len(flows) > 0 {
		*flow = flows[0]
	}

	return nil
}

// GetFlowByID retrieves a flow by ID
func (r *FlowRepository) GetFlowByID(ctx context.Context, flowID string) (*models.ChatbotFlow, error) {
	data, err := r.supabase.QueryAsAdmin("chatbot_flows", map[string]string{
		"select": "*",
		"id":     fmt.Sprintf("eq.%s", flowID),
		"limit":  "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get flow: %w", err)
	}

	var flows []models.ChatbotFlow
	if err := json.Unmarshal(data, &flows); err != nil {
		return nil, fmt.Errorf("failed to parse flow: %w", err)
	}

	if len(flows) == 0 {
		return nil, fmt.Errorf("flow not found")
	}

	return &flows[0], nil
}

// GetFlowsByDeviceID retrieves all flows for a device
func (r *FlowRepository) GetFlowsByDeviceID(ctx context.Context, deviceID string) ([]models.ChatbotFlow, error) {
	data, err := r.supabase.QueryAsAdmin("chatbot_flows", map[string]string{
		"select":    "*",
		"id_device": fmt.Sprintf("eq.%s", deviceID),
		"order":     "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get flows: %w", err)
	}

	var flows []models.ChatbotFlow
	if err := json.Unmarshal(data, &flows); err != nil {
		return nil, fmt.Errorf("failed to parse flows: %w", err)
	}

	return flows, nil
}

// GetAllFlowsByUserDevices retrieves all flows for all user devices
func (r *FlowRepository) GetAllFlowsByUserDevices(ctx context.Context, deviceIDs []string) ([]models.ChatbotFlow, error) {
	if len(deviceIDs) == 0 {
		return []models.ChatbotFlow{}, nil
	}

	// Build OR query for multiple devices
	var allFlows []models.ChatbotFlow
	for _, deviceID := range deviceIDs {
		flows, err := r.GetFlowsByDeviceID(ctx, deviceID)
		if err != nil {
			continue // Skip errors for individual devices
		}
		allFlows = append(allFlows, flows...)
	}

	return allFlows, nil
}

// GetAllFlows retrieves all flows (admin only)
func (r *FlowRepository) GetAllFlows(ctx context.Context) ([]models.ChatbotFlow, error) {
	data, err := r.supabase.QueryAsAdmin("chatbot_flows", map[string]string{
		"select": "*",
		"order":  "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get all flows: %w", err)
	}

	var flows []models.ChatbotFlow
	if err := json.Unmarshal(data, &flows); err != nil {
		return nil, fmt.Errorf("failed to parse flows: %w", err)
	}

	return flows, nil
}

// UpdateFlow updates a flow
func (r *FlowRepository) UpdateFlow(ctx context.Context, flowID string, updates map[string]interface{}) error {
	// Add updated_at timestamp
	updates["updated_at"] = time.Now()

	_, err := r.supabase.UpdateAsAdmin("chatbot_flows", map[string]string{
		"id": flowID,
	}, updates)

	if err != nil {
		return fmt.Errorf("failed to update flow: %w", err)
	}

	return nil
}

// DeleteFlow deletes a flow
func (r *FlowRepository) DeleteFlow(ctx context.Context, flowID string) error {
	// Use DeleteAsAdmin to bypass RLS policies
	err := r.supabase.DeleteAsAdmin("chatbot_flows", map[string]string{
		"id": flowID,
	})

	if err != nil {
		return fmt.Errorf("failed to delete flow: %w", err)
	}

	return nil
}
