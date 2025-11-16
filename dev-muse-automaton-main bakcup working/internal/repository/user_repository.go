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

// UserRepository handles user data operations
type UserRepository struct {
	supabase *database.SupabaseClient
}

// NewUserRepository creates a new user repository
func NewUserRepository(supabase *database.SupabaseClient) *UserRepository {
	return &UserRepository{
		supabase: supabase,
	}
}

// CreateUser creates a new user
func (r *UserRepository) CreateUser(ctx context.Context, user *models.User) error {
	// Generate UUID for new user
	user.ID = uuid.New().String()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	user.IsActive = true
	user.Status = "Trial"

	// Insert using service role (bypasses RLS)
	data, err := r.supabase.InsertAsAdmin("user", user)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	// Parse response to get created user
	var users []models.User
	if err := json.Unmarshal(data, &users); err != nil {
		return fmt.Errorf("failed to parse created user: %w", err)
	}

	if len(users) > 0 {
		*user = users[0]
	}

	return nil
}

// GetUserByEmail retrieves a user by email
func (r *UserRepository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	// Query using service role (bypasses RLS)
	data, err := r.supabase.QueryAsAdmin("user", map[string]string{
		"select": "*",
		"email":  fmt.Sprintf("eq.%s", email),
		"limit":  "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}

	var users []models.User
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, fmt.Errorf("failed to parse user: %w", err)
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	return &users[0], nil
}

// GetUserByID retrieves a user by ID
func (r *UserRepository) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	// Query using service role (bypasses RLS)
	data, err := r.supabase.QueryAsAdmin("user", map[string]string{
		"select": "*",
		"id":     fmt.Sprintf("eq.%s", userID),
		"limit":  "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}

	var users []models.User
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, fmt.Errorf("failed to parse user: %w", err)
	}

	if len(users) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	return &users[0], nil
}

// UpdateLastLogin updates the last login timestamp for a user
func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID string) error {
	now := time.Now()
	updateData := map[string]interface{}{
		"last_login": now,
	}

	_, err := r.supabase.Update("user", map[string]string{
		"id": fmt.Sprintf("eq.%s", userID),
	}, updateData)

	if err != nil {
		return fmt.Errorf("failed to update last login: %w", err)
	}

	return nil
}

// CreateSession creates a new user session
func (r *UserRepository) CreateSession(ctx context.Context, session *models.UserSession) error {
	session.ID = uuid.New().String()
	session.CreatedAt = time.Now()
	session.ExpiresAt = time.Now().Add(24 * time.Hour * 7) // 7 days

	// Insert using service role (bypasses RLS)
	_, err := r.supabase.InsertAsAdmin("user_sessions", session)
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}

	return nil
}

// GetSessionByToken retrieves a session by token
func (r *UserRepository) GetSessionByToken(ctx context.Context, token string) (*models.UserSession, error) {
	data, err := r.supabase.QueryAsAdmin("user_sessions", map[string]string{
		"select": "*",
		"token":  fmt.Sprintf("eq.%s", token),
		"limit":  "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	var sessions []models.UserSession
	if err := json.Unmarshal(data, &sessions); err != nil {
		return nil, fmt.Errorf("failed to parse session: %w", err)
	}

	if len(sessions) == 0 {
		return nil, fmt.Errorf("session not found")
	}

	// Check if session is expired
	if sessions[0].ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("session expired")
	}

	return &sessions[0], nil
}

// UpdatePassword updates a user's password
func (r *UserRepository) UpdatePassword(ctx context.Context, userID string, hashedPassword string) error {
	updateData := map[string]interface{}{
		"password":   hashedPassword,
		"updated_at": time.Now(),
	}

	_, err := r.supabase.UpdateAsAdmin("user", map[string]string{
		"id": userID,
	}, updateData)

	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// UpdateProfile updates user profile (gmail and phone)
func (r *UserRepository) UpdateProfile(ctx context.Context, userID string, gmail *string, phone *string) error {
	updateData := map[string]interface{}{
		"updated_at": time.Now(),
	}

	if gmail != nil {
		updateData["gmail"] = *gmail
	}

	if phone != nil {
		updateData["phone"] = *phone
	}

	_, err := r.supabase.UpdateAsAdmin("user", map[string]string{
		"id": userID,
	}, updateData)

	if err != nil {
		return fmt.Errorf("failed to update profile: %w", err)
	}

	return nil
}

// UpgradeUserToPro upgrades user to Pro status with expiration date
func (r *UserRepository) UpgradeUserToPro(ctx context.Context, userID string, expirationDate time.Time) error {
	// Format expiration date as YYYY-MM-DD string for database
	expirationStr := expirationDate.Format("2006-01-02")

	updateData := map[string]interface{}{
		"status":     "Pro",
		"expired":    expirationStr,
		"updated_at": time.Now(),
	}

	_, err := r.supabase.UpdateAsAdmin("user", map[string]string{
		"id": userID,
	}, updateData)

	if err != nil {
		return fmt.Errorf("failed to upgrade user to Pro: %w", err)
	}

	return nil
}
