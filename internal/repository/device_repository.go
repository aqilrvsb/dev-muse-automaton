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

// DeviceRepository handles device data operations
type DeviceRepository struct {
	supabase *database.SupabaseClient
}

// NewDeviceRepository creates a new device repository
func NewDeviceRepository(supabase *database.SupabaseClient) *DeviceRepository {
	return &DeviceRepository{
		supabase: supabase,
	}
}

// CreateDevice creates a new device
func (r *DeviceRepository) CreateDevice(ctx context.Context, device *models.DeviceSetting) error {
	// Generate UUID for new device
	device.ID = uuid.New().String()
	device.CreatedAt = time.Now()
	device.UpdatedAt = time.Now()

	// Insert using service role (bypasses RLS)
	data, err := r.supabase.InsertAsAdmin("device_setting", device)
	if err != nil {
		return fmt.Errorf("failed to create device: %w", err)
	}

	// Parse response to get created device
	var devices []models.DeviceSetting
	if err := json.Unmarshal(data, &devices); err != nil {
		return fmt.Errorf("failed to parse created device: %w", err)
	}

	if len(devices) > 0 {
		*device = devices[0]
	}

	return nil
}

// GetDeviceByID retrieves a device by ID
func (r *DeviceRepository) GetDeviceByID(ctx context.Context, deviceID string) (*models.DeviceSetting, error) {
	data, err := r.supabase.QueryAsAdmin("device_setting", map[string]string{
		"select": "*",
		"id":     fmt.Sprintf("eq.%s", deviceID),
		"limit":  "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get device: %w", err)
	}

	var devices []models.DeviceSetting
	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse device: %w", err)
	}

	if len(devices) == 0 {
		return nil, fmt.Errorf("device not found")
	}

	return &devices[0], nil
}

// GetDevicesByUserID retrieves all devices for a user
func (r *DeviceRepository) GetDevicesByUserID(ctx context.Context, userID string) ([]models.DeviceSetting, error) {
	data, err := r.supabase.QueryAsAdmin("device_setting", map[string]string{
		"select":  "*",
		"user_id": fmt.Sprintf("eq.%s", userID),
		"order":   "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get devices: %w", err)
	}

	var devices []models.DeviceSetting
	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse devices: %w", err)
	}

	return devices, nil
}

// GetAllDevices retrieves all devices (admin only)
func (r *DeviceRepository) GetAllDevices(ctx context.Context) ([]models.DeviceSetting, error) {
	data, err := r.supabase.QueryAsAdmin("device_setting", map[string]string{
		"select": "*",
		"order":  "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get all devices: %w", err)
	}

	var devices []models.DeviceSetting
	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse devices: %w", err)
	}

	return devices, nil
}

// UpdateDevice updates a device
func (r *DeviceRepository) UpdateDevice(ctx context.Context, deviceID string, updates map[string]interface{}) error {
	// Add updated_at timestamp
	updates["updated_at"] = time.Now()

	_, err := r.supabase.UpdateAsAdmin("device_setting", map[string]string{
		"id": deviceID,
	}, updates)

	if err != nil {
		return fmt.Errorf("failed to update device: %w", err)
	}

	return nil
}

// DeleteDevice deletes a device
func (r *DeviceRepository) DeleteDevice(ctx context.Context, deviceID string) error {
	err := r.supabase.Delete("device_setting", map[string]string{
		"id": deviceID,
	})

	if err != nil {
		return fmt.Errorf("failed to delete device: %w", err)
	}

	return nil
}

// GetDeviceByDeviceID retrieves a device by device_id field or id_device field
func (r *DeviceRepository) GetDeviceByDeviceID(ctx context.Context, deviceID string) (*models.DeviceSetting, error) {
	// Try device_id field first
	data, err := r.supabase.QueryAsAdmin("device_setting", map[string]string{
		"select":    "*",
		"device_id": fmt.Sprintf("eq.%s", deviceID),
		"limit":     "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get device by device_id: %w", err)
	}

	var devices []models.DeviceSetting
	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse device: %w", err)
	}

	if len(devices) > 0 {
		return &devices[0], nil
	}

	// If not found by device_id, try id_device field
	data, err = r.supabase.QueryAsAdmin("device_setting", map[string]string{
		"select":    "*",
		"id_device": fmt.Sprintf("eq.%s", deviceID),
		"limit":     "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get device by id_device: %w", err)
	}

	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse device: %w", err)
	}

	if len(devices) == 0 {
		return nil, nil // Device not found in either field, return nil without error
	}

	return &devices[0], nil
}

// GetDeviceByIDDevice retrieves a device by id_device field only
func (r *DeviceRepository) GetDeviceByIDDevice(ctx context.Context, idDevice string) (*models.DeviceSetting, error) {
	data, err := r.supabase.QueryAsAdmin("device_setting", map[string]string{
		"select":    "*",
		"id_device": fmt.Sprintf("eq.%s", idDevice),
		"limit":     "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get device by id_device: %w", err)
	}

	var devices []models.DeviceSetting
	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse device: %w", err)
	}

	if len(devices) == 0 {
		return nil, nil // Device not found, return nil without error
	}

	return &devices[0], nil
}

// GetDeviceByWebhookID retrieves a device by webhook_id
func (r *DeviceRepository) GetDeviceByWebhookID(ctx context.Context, webhookID string) (*models.DeviceSetting, error) {
	data, err := r.supabase.QueryAsAdmin("device_setting", map[string]string{
		"select":     "*",
		"webhook_id": fmt.Sprintf("eq.%s", webhookID),
		"limit":      "1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get device by webhook_id: %w", err)
	}

	var devices []models.DeviceSetting
	if err := json.Unmarshal(data, &devices); err != nil {
		return nil, fmt.Errorf("failed to parse device: %w", err)
	}

	if len(devices) == 0 {
		return nil, nil // Device not found, return nil without error
	}

	return &devices[0], nil
}
