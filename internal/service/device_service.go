package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"fmt"
)

// DeviceService handles device business logic
type DeviceService struct {
	deviceRepo *repository.DeviceRepository
}

// NewDeviceService creates a new device service
func NewDeviceService(deviceRepo *repository.DeviceRepository) *DeviceService {
	return &DeviceService{
		deviceRepo: deviceRepo,
	}
}

// CreateDevice creates a new device for a user
func (s *DeviceService) CreateDevice(ctx context.Context, userID string, req *models.CreateDeviceRequest) (*models.DeviceResponse, error) {
	// Validate provider
	validProviders := map[string]bool{
		"waha":       true,
		"wablas":     true,
		"whacenter":  true,
	}

	if !validProviders[req.Provider] {
		return &models.DeviceResponse{
			Success: false,
			Message: "Invalid provider. Must be one of: waha, wablas, whacenter",
		}, nil
	}

	// Check if device_id already exists (only for wablas provider)
	if req.Provider == "wablas" && req.DeviceID != "" {
		existingDevice, err := s.deviceRepo.GetDeviceByDeviceID(ctx, req.DeviceID)
		if err != nil {
			return nil, fmt.Errorf("failed to check existing device: %w", err)
		}

		if existingDevice != nil {
			return &models.DeviceResponse{
				Success: false,
				Message: "Device with this device_id already exists",
			}, nil
		}
	}

	// Check if id_device already exists
	if req.IDDevice != nil && *req.IDDevice != "" {
		existingDevice, err := s.deviceRepo.GetDeviceByIDDevice(ctx, *req.IDDevice)
		if err != nil {
			return nil, fmt.Errorf("failed to check existing id_device: %w", err)
		}

		if existingDevice != nil {
			return &models.DeviceResponse{
				Success: false,
				Message: "Device with this ID Device already exists",
			}, nil
		}
	}

	// Create device - set DeviceID to nil for non-wablas providers
	var deviceID *string
	if req.Provider == "wablas" && req.DeviceID != "" {
		deviceID = &req.DeviceID
	}

	device := &models.DeviceSetting{
		DeviceID:     deviceID,
		WebhookID:    &req.WebhookURL,
		Provider:     req.Provider,
		APIKeyOption: req.APIKeyOption,
		APIKey:       req.APIKey,
		PhoneNumber:  &req.PhoneNumber,
		IDDevice:     req.IDDevice,
		IDERP:        req.IDERP,
		IDAdmin:      req.IDAdmin,
		Instance:     req.Instance,
		UserID:       &userID,
	}

	if err := s.deviceRepo.CreateDevice(ctx, device); err != nil {
		return nil, fmt.Errorf("failed to create device: %w", err)
	}

	return &models.DeviceResponse{
		Success: true,
		Message: "Device created successfully",
		Device:  device,
	}, nil
}

// GetDevice retrieves a device by ID
func (s *DeviceService) GetDevice(ctx context.Context, userID, deviceID string) (*models.DeviceResponse, error) {
	device, err := s.deviceRepo.GetDeviceByID(ctx, deviceID)
	if err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Device not found",
		}, nil
	}

	// Check ownership
	if device.UserID == nil || *device.UserID != userID {
		return &models.DeviceResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	return &models.DeviceResponse{
		Success: true,
		Device:  device,
	}, nil
}

// GetUserDevices retrieves all devices for a user
func (s *DeviceService) GetUserDevices(ctx context.Context, userID string) (*models.DeviceResponse, error) {
	devices, err := s.deviceRepo.GetDevicesByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get devices: %w", err)
	}

	return &models.DeviceResponse{
		Success: true,
		Message: fmt.Sprintf("Found %d devices", len(devices)),
		Devices: devices,
	}, nil
}

// GetAllDevices retrieves all devices (admin only)
func (s *DeviceService) GetAllDevices(ctx context.Context) (*models.DeviceResponse, error) {
	devices, err := s.deviceRepo.GetAllDevices(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get all devices: %w", err)
	}

	return &models.DeviceResponse{
		Success: true,
		Message: fmt.Sprintf("Found %d devices (admin view)", len(devices)),
		Devices: devices,
	}, nil
}

// UpdateDevice updates a device
func (s *DeviceService) UpdateDevice(ctx context.Context, userID, deviceID string, req *models.UpdateDeviceRequest) (*models.DeviceResponse, error) {
	// Get device and check ownership
	device, err := s.deviceRepo.GetDeviceByID(ctx, deviceID)
	if err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Device not found",
		}, nil
	}

	if device.UserID == nil || *device.UserID != userID {
		return &models.DeviceResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	// Build update map
	updates := make(map[string]interface{})

	if req.WebhookURL != nil {
		updates["webhook_id"] = *req.WebhookURL
	}
	if req.Provider != nil {
		updates["provider"] = *req.Provider
	}
	if req.APIKeyOption != nil {
		updates["api_key_option"] = *req.APIKeyOption
	}
	if req.APIKey != nil {
		updates["api_key"] = *req.APIKey
	}
	if req.PhoneNumber != nil {
		updates["phone_number"] = *req.PhoneNumber
	}
	if req.IDDevice != nil {
		updates["id_device"] = *req.IDDevice
	}
	if req.IDERP != nil {
		updates["id_erp"] = *req.IDERP
	}
	if req.IDAdmin != nil {
		updates["id_admin"] = *req.IDAdmin
	}
	if req.Instance != nil {
		updates["instance"] = *req.Instance
	}

	if len(updates) == 0 {
		return &models.DeviceResponse{
			Success: false,
			Message: "No fields to update",
		}, nil
	}

	if err := s.deviceRepo.UpdateDevice(ctx, deviceID, updates); err != nil {
		return nil, fmt.Errorf("failed to update device: %w", err)
	}

	// Get updated device
	updatedDevice, _ := s.deviceRepo.GetDeviceByID(ctx, deviceID)

	return &models.DeviceResponse{
		Success: true,
		Message: "Device updated successfully",
		Device:  updatedDevice,
	}, nil
}

// DeleteDevice deletes a device
func (s *DeviceService) DeleteDevice(ctx context.Context, userID, deviceID string) (*models.DeviceResponse, error) {
	// Get device and check ownership
	device, err := s.deviceRepo.GetDeviceByID(ctx, deviceID)
	if err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Device not found",
		}, nil
	}

	if device.UserID == nil || *device.UserID != userID {
		return &models.DeviceResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	if err := s.deviceRepo.DeleteDevice(ctx, deviceID); err != nil {
		return nil, fmt.Errorf("failed to delete device: %w", err)
	}

	return &models.DeviceResponse{
		Success: true,
		Message: "Device deleted successfully",
	}, nil
}
