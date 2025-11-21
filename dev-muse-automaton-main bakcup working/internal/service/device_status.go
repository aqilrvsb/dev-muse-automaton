package service

import (
	"chatbot-automation/internal/models"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// CheckDeviceStatus checks the connection status and gets QR code if needed
func (s *DeviceService) CheckDeviceStatus(ctx context.Context, userID, deviceID string) (*models.DeviceStatusResponse, error) {
	// Get device and check ownership
	device, err := s.deviceRepo.GetDeviceByID(ctx, deviceID)
	if err != nil {
		return &models.DeviceStatusResponse{
			Success: false,
			Message: "Device not found",
		}, nil
	}

	if device.UserID == nil || *device.UserID != userID {
		return &models.DeviceStatusResponse{
			Success: false,
			Message: "Access denied",
		}, nil
	}

	// Check if instance exists
	if device.Instance == nil || *device.Instance == "" {
		return &models.DeviceStatusResponse{
			Success: false,
			Message: "Device not generated yet. Please generate device first.",
		}, nil
	}

	// Check status based on provider
	switch device.Provider {
	case "whacenter":
		return s.checkWhacenterStatus(ctx, device)
	case "waha":
		return s.checkWahaStatus(ctx, device)
	default:
		return &models.DeviceStatusResponse{
			Success: false,
			Message: fmt.Sprintf("Provider %s not supported for status check", device.Provider),
		}, nil
	}
}

// checkWhacenterStatus checks Whacenter device status and gets QR if not connected
func (s *DeviceService) checkWhacenterStatus(ctx context.Context, device *models.DeviceSetting) (*models.DeviceStatusResponse, error) {
	instance := *device.Instance
	client := &http.Client{Timeout: 30 * time.Second}

	// Step 1: Check device status
	statusURL := fmt.Sprintf("https://api.whacenter.com/api/statusDevice?device_id=%s", instance)
	req, _ := http.NewRequest("GET", statusURL, nil)

	resp, err := client.Do(req)
	if err != nil {
		return &models.DeviceStatusResponse{
			Success: false,
			Message: "Failed to check device status: " + err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var statusResp struct {
		Status  bool   `json:"status"`
		Message string `json:"message"`
		Data    struct {
			Status string `json:"status"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &statusResp); err != nil {
		return &models.DeviceStatusResponse{
			Success: false,
			Message: "Failed to parse status response",
		}, nil
	}

	response := &models.DeviceStatusResponse{
		Success:  true,
		Provider: "whacenter",
		Status:   statusResp.Data.Status,
		Message:  statusResp.Message,
	}

	// Step 2: If NOT CONNECTED, get QR code
	if statusResp.Data.Status == "NOT CONNECTED" {
		qrURL := fmt.Sprintf("https://api.whacenter.com/api/qr?device_id=%s", instance)
		qrReq, _ := http.NewRequest("GET", qrURL, nil)

		qrResp, err := client.Do(qrReq)
		if err != nil {
			response.Message = "Device not connected. Failed to get QR code."
			return response, nil
		}
		defer qrResp.Body.Close()

		qrData, _ := io.ReadAll(qrResp.Body)

		// Check if it's a valid PNG
		if len(qrData) > 8 && strings.Contains(string(qrData[:8]), "PNG") {
			// Convert to base64 data URL
			base64Image := base64.StdEncoding.EncodeToString(qrData)
			response.QRImage = "data:image/png;base64," + base64Image
		}
	}

	return response, nil
}

// checkWahaStatus checks Waha session status and gets QR if needed
func (s *DeviceService) checkWahaStatus(ctx context.Context, device *models.DeviceSetting) (*models.DeviceStatusResponse, error) {
	apiBase := "https://waha-plus-production-705f.up.railway.app"
	apiKey := "dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0"
	session := *device.Instance

	client := &http.Client{Timeout: 30 * time.Second}

	// Step 1: Check session status
	statusURL := fmt.Sprintf("%s/api/sessions/%s", apiBase, session)
	req, _ := http.NewRequest("GET", statusURL, nil)
	req.Header.Set("X-Api-Key", apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return &models.DeviceStatusResponse{
			Success: false,
			Message: "Failed to check session status: " + err.Error(),
		}, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var sessionData struct {
		Status string `json:"status"`
	}

	if err := json.Unmarshal(body, &sessionData); err != nil {
		return &models.DeviceStatusResponse{
			Success: false,
			Message: "Failed to parse session response",
		}, nil
	}

	status := sessionData.Status
	if status == "" {
		status = "UNKNOWN"
	}

	// Step 2: If STOPPED, try to start session
	if status == "STOPPED" {
		startURL := fmt.Sprintf("%s/api/sessions/%s/start", apiBase, session)
		startReq, _ := http.NewRequest("POST", startURL, nil)
		startReq.Header.Set("Content-Type", "application/json")
		startReq.Header.Set("X-Api-Key", apiKey)

		client.Do(startReq)

		// Wait 2 seconds for status to update
		time.Sleep(2 * time.Second)

		// Recheck status
		req, _ = http.NewRequest("GET", statusURL, nil)
		req.Header.Set("X-Api-Key", apiKey)
		resp, _ = client.Do(req)
		defer resp.Body.Close()

		body, _ = io.ReadAll(resp.Body)
		json.Unmarshal(body, &sessionData)
		status = sessionData.Status
	}

	response := &models.DeviceStatusResponse{
		Success:  true,
		Provider: "waha",
		Status:   status,
	}

	// Step 3: If SCAN_QR_CODE, get QR image
	if status == "SCAN_QR_CODE" {
		qrURL := fmt.Sprintf("%s/api/%s/auth/qr?format=image", apiBase, session)
		qrReq, _ := http.NewRequest("GET", qrURL, nil)
		qrReq.Header.Set("X-Api-Key", apiKey)
		qrReq.Header.Set("Accept", "application/json")

		qrResp, err := client.Do(qrReq)
		if err == nil {
			defer qrResp.Body.Close()
			qrBody, _ := io.ReadAll(qrResp.Body)

			var qrData struct {
				Data string `json:"data"`
			}

			if err := json.Unmarshal(qrBody, &qrData); err == nil && qrData.Data != "" {
				response.QRImage = "data:image/png;base64," + qrData.Data
			}
		}
	}

	return response, nil
}
