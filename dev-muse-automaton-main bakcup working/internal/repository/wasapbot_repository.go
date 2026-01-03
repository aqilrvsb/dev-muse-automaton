package repository

import (
	"chatbot-automation/internal/database"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// WasapbotRepository handles WhatsApp Bot conversation data operations (without AI Prompt)
type WasapbotRepository struct {
	supabase *database.SupabaseClient
}

// NewWasapbotRepository creates a new wasapbot repository
func NewWasapbotRepository(supabase *database.SupabaseClient) *WasapbotRepository {
	return &WasapbotRepository{
		supabase: supabase,
	}
}

// CreateConversation creates a new wasapbot conversation
func (r *WasapbotRepository) CreateConversation(ctx context.Context, conversation *models.Wasapbot) error {
	// Database will auto-generate id_prospect (serial/autoincrement)
	// Database will auto-set created_at, updated_at timestamps

	// Insert using service role (bypasses RLS)
	data, err := r.supabase.InsertAsAdmin("wasapbot", conversation)
	if err != nil {
		return fmt.Errorf("failed to create wasapbot conversation: %w", err)
	}

	// Parse response to get created conversation
	var conversations []models.Wasapbot
	if err := json.Unmarshal(data, &conversations); err != nil {
		return fmt.Errorf("failed to parse created wasapbot conversation: %w", err)
	}

	if len(conversations) > 0 {
		*conversation = conversations[0]
	}

	return nil
}

// GetConversationByID retrieves a wasapbot conversation by prospect ID
func (r *WasapbotRepository) GetConversationByID(ctx context.Context, prospectID string) (*models.Wasapbot, error) {
	fmt.Printf("🔍 [WasapbotRepo] GetConversationByID called with prospectID=%s\n", prospectID)

	data, err := r.supabase.QueryAsAdmin("wasapbot", map[string]string{
		"select":      "*",
		"id_prospect": fmt.Sprintf("eq.%s", prospectID),
		"limit":       "1",
	})
	if err != nil {
		fmt.Printf("❌ [WasapbotRepo] Query failed: %v\n", err)
		return nil, fmt.Errorf("failed to get wasapbot conversation: %w", err)
	}

	fmt.Printf("🔍 [WasapbotRepo] Query response: %s\n", string(data))

	var conversations []models.Wasapbot
	if err := json.Unmarshal(data, &conversations); err != nil {
		fmt.Printf("❌ [WasapbotRepo] JSON unmarshal failed: %v\n", err)
		return nil, fmt.Errorf("failed to parse wasapbot conversation: %w", err)
	}

	fmt.Printf("🔍 [WasapbotRepo] Found %d conversation(s)\n", len(conversations))

	if len(conversations) == 0 {
		fmt.Printf("❌ [WasapbotRepo] Conversation not found for id_prospect=%s\n", prospectID)
		return nil, fmt.Errorf("wasapbot conversation not found")
	}

	fmt.Printf("✅ [WasapbotRepo] Retrieved conversation: %+v\n", conversations[0])
	return &conversations[0], nil
}

// GetConversationByProspectNum retrieves a wasapbot conversation by prospect phone number and device
func (r *WasapbotRepository) GetConversationByProspectNum(ctx context.Context, prospectNum, deviceID string) (*models.Wasapbot, error) {
	data, err := r.supabase.QueryAsAdmin("wasapbot", map[string]string{
		"select":       "*",
		"prospect_num": fmt.Sprintf("eq.%s", prospectNum),
		"id_device":    fmt.Sprintf("eq.%s", deviceID),
		"limit":        "1",
		"order":        "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get wasapbot conversation: %w", err)
	}

	var conversations []models.Wasapbot
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse wasapbot conversation: %w", err)
	}

	if len(conversations) == 0 {
		return nil, nil // Not found, return nil without error
	}

	return &conversations[0], nil
}

// GetConversationsByDevice retrieves all wasapbot conversations for a device
func (r *WasapbotRepository) GetConversationsByDevice(ctx context.Context, deviceID string, limit int) ([]models.Wasapbot, error) {
	params := map[string]string{
		"select":    "*",
		"id_device": fmt.Sprintf("eq.%s", deviceID),
		"order":     "created_at.desc",
	}

	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}

	data, err := r.supabase.QueryAsAdmin("wasapbot", params)
	if err != nil {
		return nil, fmt.Errorf("failed to get wasapbot conversations: %w", err)
	}

	var conversations []models.Wasapbot
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse wasapbot conversations: %w", err)
	}

	return conversations, nil
}

// UpdateConversation updates a wasapbot conversation
func (r *WasapbotRepository) UpdateConversation(ctx context.Context, prospectID string, updates map[string]interface{}) error {
	// Add updated_at timestamp
	updates["updated_at"] = time.Now()

	fmt.Printf("🔍 [WasapbotRepo] Updating prospect_id=%s with updates=%+v\n", prospectID, updates)

	data, err := r.supabase.UpdateAsAdmin("wasapbot", map[string]string{
		"id_prospect": prospectID,
	}, updates)

	if err != nil {
		fmt.Printf("❌ [WasapbotRepo] Update failed: %v\n", err)
		return fmt.Errorf("failed to update wasapbot conversation: %w", err)
	}

	fmt.Printf("✅ [WasapbotRepo] Update response: %s\n", string(data))
	return nil
}

// DeleteConversation deletes a wasapbot conversation
func (r *WasapbotRepository) DeleteConversation(ctx context.Context, prospectID string) error {
	err := r.supabase.Delete("wasapbot", map[string]string{
		"id_prospect": prospectID,
	})

	if err != nil {
		return fmt.Errorf("failed to delete wasapbot conversation: %w", err)
	}

	return nil
}
