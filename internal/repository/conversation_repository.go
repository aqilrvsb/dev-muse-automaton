package repository

import (
	"chatbot-automation/internal/database"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// ConversationRepository handles conversation data operations
type ConversationRepository struct {
	supabase *database.SupabaseClient
}

// NewConversationRepository creates a new conversation repository
func NewConversationRepository(supabase *database.SupabaseClient) *ConversationRepository {
	return &ConversationRepository{
		supabase: supabase,
	}
}

// CreateConversation creates a new conversation
func (r *ConversationRepository) CreateConversation(ctx context.Context, conversation *models.AIWhatsapp) error {
	// Database will auto-generate id_prospect (serial/autoincrement)
	// Database will auto-set created_at, updated_at timestamps

	// Initialize conv_last with just the user message for now
	// Bot reply will be added during flow execution
	// Format: "User: message\nBot: reply"

	// Insert using service role (bypasses RLS)
	data, err := r.supabase.InsertAsAdmin("ai_whatsapp", conversation)
	if err != nil {
		return fmt.Errorf("failed to create conversation: %w", err)
	}

	// Parse response to get created conversation
	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(data, &conversations); err != nil {
		return fmt.Errorf("failed to parse created conversation: %w", err)
	}

	if len(conversations) > 0 {
		*conversation = conversations[0]
	}

	return nil
}

// GetConversationByID retrieves a conversation by prospect ID
func (r *ConversationRepository) GetConversationByID(ctx context.Context, prospectID string) (*models.AIWhatsapp, error) {
	data, err := r.supabase.QueryAsAdmin("ai_whatsapp", map[string]string{
		"select":      "*",
		"id_prospect": fmt.Sprintf("eq.%s", prospectID),
		"limit":       "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse conversation: %w", err)
	}

	if len(conversations) == 0 {
		return nil, fmt.Errorf("conversation not found")
	}

	return &conversations[0], nil
}

// GetConversationByProspectNum retrieves a conversation by prospect phone number and device
func (r *ConversationRepository) GetConversationByProspectNum(ctx context.Context, prospectNum, deviceID string) (*models.AIWhatsapp, error) {
	data, err := r.supabase.QueryAsAdmin("ai_whatsapp", map[string]string{
		"select":       "*",
		"prospect_num": fmt.Sprintf("eq.%s", prospectNum),
		"id_device":    fmt.Sprintf("eq.%s", deviceID),
		"limit":        "1",
		"order":        "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation: %w", err)
	}

	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse conversation: %w", err)
	}

	if len(conversations) == 0 {
		return nil, nil // Not found, return nil without error
	}

	return &conversations[0], nil
}

// GetConversationsByDevice retrieves all conversations for a device
func (r *ConversationRepository) GetConversationsByDevice(ctx context.Context, deviceID string, limit int) ([]models.AIWhatsapp, error) {
	params := map[string]string{
		"select":    "*",
		"id_device": fmt.Sprintf("eq.%s", deviceID),
		"order":     "created_at.desc",
	}

	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}

	data, err := r.supabase.QueryAsAdmin("ai_whatsapp", params)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversations: %w", err)
	}

	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse conversations: %w", err)
	}

	return conversations, nil
}

// GetActiveConversationsByDevice retrieves all active conversations for a device
func (r *ConversationRepository) GetActiveConversationsByDevice(ctx context.Context, deviceID string) ([]models.AIWhatsapp, error) {
	data, err := r.supabase.QueryAsAdmin("ai_whatsapp", map[string]string{
		"select":    "*",
		"id_device": fmt.Sprintf("eq.%s", deviceID),
		"is_active": "eq.true",
		"status":    "eq.active",
		"order":     "last_interaction.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get active conversations: %w", err)
	}

	var conversations []models.AIWhatsapp
	if err := json.Unmarshal(data, &conversations); err != nil {
		return nil, fmt.Errorf("failed to parse conversations: %w", err)
	}

	return conversations, nil
}

// UpdateConversation updates a conversation
func (r *ConversationRepository) UpdateConversation(ctx context.Context, prospectID string, updates map[string]interface{}) error {
	// Add updated_at timestamp
	updates["updated_at"] = time.Now()

	_, err := r.supabase.UpdateAsAdmin("ai_whatsapp", map[string]string{
		"id_prospect": prospectID,
	}, updates)

	if err != nil {
		return fmt.Errorf("failed to update conversation: %w", err)
	}

	return nil
}

// UpdateLastInteraction updates the last interaction timestamp
func (r *ConversationRepository) UpdateLastInteraction(ctx context.Context, prospectID string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"last_interaction": now,
		"updated_at":       now,
	}

	_, err := r.supabase.UpdateAsAdmin("ai_whatsapp", map[string]string{
		"id_prospect": prospectID,
	}, updates)

	if err != nil {
		return fmt.Errorf("failed to update last interaction: %w", err)
	}

	return nil
}

// GetConversationByPhoneAndDevice is an alias for GetConversationByProspectNum
func (r *ConversationRepository) GetConversationByPhoneAndDevice(ctx context.Context, phone, deviceID string) (*models.AIWhatsapp, error) {
	return r.GetConversationByProspectNum(ctx, phone, deviceID)
}

// UpdateConversationModel updates a conversation using a model struct
func (r *ConversationRepository) UpdateConversationModel(ctx context.Context, prospectID int, conversation *models.AIWhatsapp) error {
	updates := map[string]interface{}{}

	if conversation.ConvLast != nil {
		updates["conv_last"] = *conversation.ConvLast
	}
	if conversation.ConvCurrent != nil {
		updates["conv_current"] = *conversation.ConvCurrent
	}
	if conversation.ProspectName != nil {
		updates["prospect_name"] = *conversation.ProspectName
	}
	if conversation.Stage != nil {
		updates["stage"] = *conversation.Stage
	}

	return r.UpdateConversation(ctx, fmt.Sprintf("%d", prospectID), updates)
}

// DeleteConversation deletes a conversation
func (r *ConversationRepository) DeleteConversation(ctx context.Context, prospectID string) error {
	err := r.supabase.Delete("ai_whatsapp", map[string]string{
		"id_prospect": prospectID,
	})

	if err != nil {
		return fmt.Errorf("failed to delete conversation: %w", err)
	}

	return nil
}

// GetConversationStats retrieves conversation statistics for a device
func (r *ConversationRepository) GetConversationStats(ctx context.Context, deviceID string) (*models.ConversationStats, error) {
	// Get all conversations for the device
	conversations, err := r.GetConversationsByDevice(ctx, deviceID, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversations for stats: %w", err)
	}

	stats := &models.ConversationStats{
		TotalConversations: len(conversations),
		ByStage:            make(map[string]int),
		ByNiche:            make(map[string]int),
		ByDevice:           make(map[string]int),
	}

	// Calculate statistics
	for _, conv := range conversations {
		// Count by execution status
		status := "active"
		if conv.ExecutionStatus != nil && *conv.ExecutionStatus != "" {
			status = *conv.ExecutionStatus
		}

		switch status {
		case "active":
			stats.ActiveConversations++
		case "completed":
			stats.CompletedConversations++
		case "abandoned":
			stats.AbandonedConversations++
		}

		// Count by stage
		if conv.Stage != nil {
			stats.ByStage[*conv.Stage]++
		}

		// Count by niche
		if conv.Niche != nil {
			stats.ByNiche[*conv.Niche]++
		}

		// Count by device
		stats.ByDevice[conv.IDDevice]++
	}

	return stats, nil
}

// GetWasapBotContact retrieves a contact from wasapbot table
func (r *ConversationRepository) GetWasapBotContact(ctx context.Context, deviceID, prospectNum, niche string) (*models.WasapBot, error) {
	data, err := r.supabase.QueryAsAdmin("wasapbot", map[string]string{
		"select":       "*",
		"id_device":    fmt.Sprintf("eq.%s", deviceID),
		"prospect_num": fmt.Sprintf("eq.%s", prospectNum),
		"niche":        fmt.Sprintf("eq.%s", niche),
		"limit":        "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get wasapbot contact: %w", err)
	}

	var contacts []models.WasapBot
	if err := json.Unmarshal(data, &contacts); err != nil {
		return nil, fmt.Errorf("failed to parse wasapbot contact: %w", err)
	}

	if len(contacts) == 0 {
		return nil, nil // Contact not found
	}

	return &contacts[0], nil
}

// CreateWasapBotContact creates a new contact in wasapbot table
func (r *ConversationRepository) CreateWasapBotContact(ctx context.Context, contact *models.WasapBot) error {
	now := time.Now().Format(time.RFC3339)
	contact.CreatedAt = &now
	contact.UpdatedAt = &now

	data, err := r.supabase.InsertAsAdmin("wasapbot", contact)
	if err != nil {
		return fmt.Errorf("failed to create wasapbot contact: %w", err)
	}

	// Parse response to get created contact
	var contacts []models.WasapBot
	if err := json.Unmarshal(data, &contacts); err != nil {
		return fmt.Errorf("failed to parse created wasapbot contact: %w", err)
	}

	if len(contacts) > 0 {
		*contact = contacts[0]
	}

	return nil
}

// UpdateWasapBotContact updates an existing contact in wasapbot table
func (r *ConversationRepository) UpdateWasapBotContact(ctx context.Context, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().Format(time.RFC3339)

	_, err := r.supabase.UpdateAsAdmin("wasapbot", map[string]string{
		"id": id,
	}, updates)

	if err != nil {
		return fmt.Errorf("failed to update wasapbot contact: %w", err)
	}

	return nil
}
