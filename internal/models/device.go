package models

import "time"

// DeviceSetting represents a WhatsApp device configuration
type DeviceSetting struct {
	ID           string     `json:"id"`
	DeviceID     *string    `json:"device_id,omitempty"`
	Instance     *string    `json:"instance,omitempty"`
	WebhookID    *string    `json:"webhook_id,omitempty"`
	Provider     string     `json:"provider"` // waha, wablas, whacenter
	APIURL       *string    `json:"api_url,omitempty"` // Base URL for provider API
	APIKeyOption string     `json:"api_key_option"` // openai/gpt-4.1, etc.
	APIKey       *string    `json:"api_key,omitempty"`
	IDDevice     *string    `json:"id_device,omitempty"`
	IDERP        *string    `json:"id_erp,omitempty"`
	IDAdmin      *string    `json:"id_admin,omitempty"`
	PhoneNumber  *string    `json:"phone_number,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	UserID       *string    `json:"user_id,omitempty"`
}

// CreateDeviceRequest is the request body for creating a device
type CreateDeviceRequest struct {
	DeviceID     string  `json:"device_id"` // Only required for wablas provider
	WebhookURL   string  `json:"webhook_url"`
	Provider     string  `json:"provider" validate:"required,oneof=waha wablas whacenter"`
	APIURL       *string `json:"api_url,omitempty"` // Base URL for provider API
	APIKeyOption string  `json:"api_key_option" validate:"required"`
	APIKey       *string `json:"api_key,omitempty"`
	PhoneNumber  string  `json:"phone_number" validate:"required"`
	IDDevice     *string `json:"id_device,omitempty"`
	IDERP        *string `json:"id_erp,omitempty"`
	IDAdmin      *string `json:"id_admin,omitempty"`
	Instance     *string `json:"instance,omitempty"`
}

// UpdateDeviceRequest is the request body for updating a device
type UpdateDeviceRequest struct {
	WebhookURL   *string `json:"webhook_url,omitempty"`
	Provider     *string `json:"provider,omitempty"`
	APIURL       *string `json:"api_url,omitempty"` // Base URL for provider API
	APIKeyOption *string `json:"api_key_option,omitempty"`
	APIKey       *string `json:"api_key,omitempty"`
	PhoneNumber  *string `json:"phone_number,omitempty"`
	IDDevice     *string `json:"id_device,omitempty"`
	IDERP        *string `json:"id_erp,omitempty"`
	IDAdmin      *string `json:"id_admin,omitempty"`
	Instance     *string `json:"instance,omitempty"`
}

// DeviceResponse is the response for device operations
type DeviceResponse struct {
	Success bool           `json:"success"`
	Message string         `json:"message"`
	Device  *DeviceSetting `json:"device,omitempty"`
	Devices []DeviceSetting `json:"devices,omitempty"`
}

// DeviceStatusResponse is the response for device status check
type DeviceStatusResponse struct {
	Success  bool   `json:"success"`
	Provider string `json:"provider"`
	Status   string `json:"status"`
	QRImage  string `json:"image,omitempty"`
	Message  string `json:"message,omitempty"`
}
