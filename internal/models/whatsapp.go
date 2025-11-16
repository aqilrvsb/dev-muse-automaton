package models

import "time"

// WhatsAppMessage represents an incoming or outgoing WhatsApp message
type WhatsAppMessage struct {
	ID          string                 `json:"id,omitempty"`
	From        string                 `json:"from"`
	To          string                 `json:"to,omitempty"`
	Body        string                 `json:"body"`
	Type        string                 `json:"type"` // text, image, document, audio, video
	MediaURL    string                 `json:"media_url,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	MessageID   string                 `json:"message_id,omitempty"`
	DeviceID    string                 `json:"device_id,omitempty"`
	Extra       map[string]interface{} `json:"extra,omitempty"` // Provider-specific fields
}

// SendMessageRequest is the request to send a WhatsApp message
type SendMessageRequest struct {
	To       string `json:"to" validate:"required"`
	Body     string `json:"body" validate:"required"`
	Type     string `json:"type"` // text, image, document, audio, video
	MediaURL string `json:"media_url,omitempty"`
	MimeType string `json:"mime_type,omitempty"` // MIME type of the media file
	DeviceID string `json:"device_id" validate:"required"`
}

// SendMessageResponse is the response after sending a message
type SendMessageResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	MessageID string `json:"message_id,omitempty"`
	Error     string `json:"error,omitempty"`
}

// WebhookPayload represents incoming webhook data from WhatsApp providers
type WebhookPayload struct {
	Event     string                 `json:"event"`
	Session   string                 `json:"session,omitempty"`
	From      string                 `json:"from"`
	Body      string                 `json:"body,omitempty"`
	Type      string                 `json:"type,omitempty"`
	MediaURL  string                 `json:"media_url,omitempty"`
	Timestamp int64                  `json:"timestamp,omitempty"`
	Raw       map[string]interface{} `json:"raw,omitempty"` // Original provider payload
}

// SessionInfo represents WhatsApp session information
type SessionInfo struct {
	SessionID   string `json:"session_id"`
	DeviceID    string `json:"device_id"`
	PhoneNumber string `json:"phone_number"`
	Status      string `json:"status"` // connected, disconnected, connecting
	QRCode      string `json:"qr_code,omitempty"`
}

// SessionStatusResponse represents session status check response
type SessionStatusResponse struct {
	Success bool         `json:"success"`
	Message string       `json:"message"`
	Session *SessionInfo `json:"session,omitempty"`
	Error   string       `json:"error,omitempty"`
}
