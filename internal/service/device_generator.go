package service

import (
	"bytes"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// GenerateDevice generates a device using Whacenter or Waha API based on provider
func (s *DeviceService) GenerateDevice(ctx context.Context, userID, deviceID string) (*models.DeviceResponse, error) {
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

	// Check if required fields are present
	if device.IDDevice == nil || *device.IDDevice == "" {
		return &models.DeviceResponse{
			Success: false,
			Message: "ID Device is required",
		}, nil
	}

	if device.PhoneNumber == nil || *device.PhoneNumber == "" {
		return &models.DeviceResponse{
			Success: false,
			Message: "Phone number is required",
		}, nil
	}

	// Generate based on provider
	switch device.Provider {
	case "whacenter":
		return s.generateWhacenterDevice(ctx, device)
	case "waha":
		return s.generateWahaDevice(ctx, device)
	default:
		return &models.DeviceResponse{
			Success: false,
			Message: fmt.Sprintf("Provider %s not supported for automatic generation", device.Provider),
		}, nil
	}
}

// generateWhacenterDevice handles Whacenter device generation
func (s *DeviceService) generateWhacenterDevice(ctx context.Context, device *models.DeviceSetting) (*models.DeviceResponse, error) {
	apiKey := "abebe840-156c-441c-8252-da0342c5a07c"
	idDevice := *device.IDDevice
	phoneNumber := *device.PhoneNumber

	// STEP 1: Delete old instance if exists
	if device.Instance != nil && *device.Instance != "" {
		oldInstance := *device.Instance
		deleteURL := fmt.Sprintf("https://api.whacenter.com/api/deleteDevice?api_key=%s&device_id=%s", apiKey, oldInstance)

		req, _ := http.NewRequest("GET", deleteURL, nil)
		req.Header.Set("accept", "application/json")
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 30 * time.Second}
		client.Do(req)

		// Clear old instance
		updates := map[string]interface{}{
			"instance":   nil,
			"webhook_id": nil,
		}
		s.deviceRepo.UpdateDevice(ctx, device.ID, updates)
	}

	// STEP 2: Add new device
	addDeviceURL := fmt.Sprintf("https://api.whacenter.com/api/addDevice?api_key=%s&name=%s&number=%s", apiKey, idDevice, phoneNumber)

	req, err := http.NewRequest("GET", addDeviceURL, nil)
	if err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Failed to create request: " + err.Error(),
		}, nil
	}

	req.Header.Set("accept", "application/json")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Failed to connect to Whacenter: " + err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var addDeviceResp struct {
		Success bool `json:"success"`
		Data    struct {
			Device struct {
				DeviceID string `json:"device_id"`
			} `json:"device"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &addDeviceResp); err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Failed to parse Whacenter response",
		}, nil
	}

	if !addDeviceResp.Success {
		return &models.DeviceResponse{
			Success: false,
			Message: "Whacenter failed to create device",
		}, nil
	}

	instance := addDeviceResp.Data.Device.DeviceID
	// Use same format as WAHA: /{idDevice}/{instance}
	webhookURL := fmt.Sprintf("https://pening-bot.deno.dev/%s/%s", idDevice, instance)

	// STEP 3: Set webhook
	setWebhookURL := fmt.Sprintf("https://api.whacenter.com/api/setWebhook?device_id=%s&webhook=%s", instance, webhookURL)

	webhookReq, _ := http.NewRequest("GET", setWebhookURL, nil)
	webhookReq.Header.Set("accept", "application/json")

	webhookResp, err := client.Do(webhookReq)
	if err != nil {
		// Save instance but no webhook
		updates := map[string]interface{}{
			"instance":   instance,
			"webhook_id": nil,
		}
		s.deviceRepo.UpdateDevice(ctx, device.ID, updates)

		return &models.DeviceResponse{
			Success: false,
			Message: "Device created but webhook setup failed",
		}, nil
	}
	defer webhookResp.Body.Close()

	webhookBody, _ := io.ReadAll(webhookResp.Body)
	var webhookResult struct {
		Success bool `json:"success"`
	}
	json.Unmarshal(webhookBody, &webhookResult)

	// Save to database
	updates := map[string]interface{}{
		"instance": instance,
	}

	if webhookResult.Success {
		updates["webhook_id"] = webhookURL
	}

	if err := s.deviceRepo.UpdateDevice(ctx, device.ID, updates); err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Failed to save device info",
		}, nil
	}

	// Get updated device
	updatedDevice, _ := s.deviceRepo.GetDeviceByID(ctx, device.ID)

	if webhookResult.Success {
		return &models.DeviceResponse{
			Success: true,
			Message: "Device generated successfully",
			Device:  updatedDevice,
		}, nil
	} else {
		return &models.DeviceResponse{
			Success: false,
			Message: "Device created but webhook failed",
			Device:  updatedDevice,
		}, nil
	}
}

// generateWahaDevice handles Waha device generation
func (s *DeviceService) generateWahaDevice(ctx context.Context, device *models.DeviceSetting) (*models.DeviceResponse, error) {
	apiBase := "https://waha-plus-production-705f.up.railway.app"
	apiKey := "dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0"
	idDevice := *device.IDDevice

	// Create session name
	sessionName := fmt.Sprintf("UserChatBot_%s", idDevice)
	webhookURL := fmt.Sprintf("https://pening-bot.deno.dev/%s/%s", idDevice, sessionName)

	client := &http.Client{Timeout: 30 * time.Second}

	// STEP 1: Delete old session if exists
	if device.Instance != nil && *device.Instance != "" {
		oldSession := *device.Instance
		deleteURL := fmt.Sprintf("%s/api/sessions/%s", apiBase, oldSession)

		req, _ := http.NewRequest("DELETE", deleteURL, nil)
		req.Header.Set("X-Api-Key", apiKey)

		client.Do(req)

		// Clear old data
		updates := map[string]interface{}{
			"instance":   nil,
			"webhook_id": nil,
		}
		s.deviceRepo.UpdateDevice(ctx, device.ID, updates)
	}

	// STEP 2: Create new session
	sessionData := map[string]interface{}{
		"name":  sessionName,
		"start": false,
		"config": map[string]interface{}{
			"debug":    false,
			"markSeen": false,
			"noweb": map[string]interface{}{
				"store": map[string]interface{}{
					"enabled":  true,
					"fullSync": false,
				},
			},
			"webhooks": []map[string]interface{}{
				{
					"url":    webhookURL,
					"events": []string{"message"},
					"retries": map[string]interface{}{
						"attempts": 1,
						"delay":    3,
						"policy":   "constant",
					},
				},
			},
		},
	}

	sessionJSON, _ := json.Marshal(sessionData)
	createURL := fmt.Sprintf("%s/api/sessions", apiBase)

	req, _ := http.NewRequest("POST", createURL, bytes.NewBuffer(sessionJSON))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Api-Key", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Failed to connect to WAHA: " + err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var createResp struct {
		Name  string `json:"name"`
		Error string `json:"error"`
	}

	if err := json.Unmarshal(body, &createResp); err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Failed to parse WAHA response",
		}, nil
	}

	if createResp.Name == "" {
		return &models.DeviceResponse{
			Success: false,
			Message: "WAHA Error: " + createResp.Error,
		}, nil
	}

	// STEP 3: Start session
	startURL := fmt.Sprintf("%s/api/sessions/%s/start", apiBase, sessionName)
	startReq, _ := http.NewRequest("POST", startURL, nil)
	startReq.Header.Set("Content-Type", "application/json")
	startReq.Header.Set("X-Api-Key", apiKey)

	client.Do(startReq)

	// Save to database
	updates := map[string]interface{}{
		"instance":   createResp.Name,
		"webhook_id": webhookURL,
	}

	if err := s.deviceRepo.UpdateDevice(ctx, device.ID, updates); err != nil {
		return &models.DeviceResponse{
			Success: false,
			Message: "Failed to save device info",
		}, nil
	}

	// Get updated device
	updatedDevice, _ := s.deviceRepo.GetDeviceByID(ctx, device.ID)

	return &models.DeviceResponse{
		Success: true,
		Message: "Device generated successfully",
		Device:  updatedDevice,
	}, nil
}
