package models

// WhacenterWebhookData represents incoming webhook data from Whacenter
type WhacenterWebhookData struct {
	IsGroup  bool   `json:"isGroup"`
	Message  string `json:"message"`
	From     string `json:"from"`
	Phone    string `json:"phone"`
	PushName string `json:"pushName"`
}

// WahaWebhookData represents incoming webhook data from Waha
type WahaWebhookData struct {
	Payload WahaPayload `json:"payload"`
}

// WahaPayload contains the actual message data from Waha
type WahaPayload struct {
	Body  string        `json:"body"`
	From  string        `json:"from"`
	Data  WahaDataInfo  `json:"_data"`
}

// WahaDataInfo contains additional info from Waha
type WahaDataInfo struct {
	Info WahaInfo `json:"Info"`
}

// WahaInfo contains sender/recipient information
type WahaInfo struct {
	PushName     string `json:"PushName"`
	SenderAlt    string `json:"SenderAlt"`
	RecipientAlt string `json:"RecipientAlt"`
}

// ExtractedMessage represents the normalized message data
type ExtractedMessage struct {
	PhoneNumber string
	Message     string
	Name        string
	Provider    string
	DeviceID    string
}

// WasapBot represents a record in wasapbot table for WhatsApp Bot flows
type WasapBot struct {
	IDProspect          *int    `json:"id_prospect,omitempty"`
	ExecutionStatus     *string `json:"execution_status,omitempty"`
	FlowID              *string `json:"flow_id,omitempty"`
	CurrentNodeID       *string `json:"current_node_id,omitempty"`
	LastNodeID          *string `json:"last_node_id,omitempty"`
	WaitingForReply     *bool   `json:"waiting_for_reply,omitempty"`
	DeviceID            string  `json:"id_device"` // Database column: id_device
	ProspectNum         string  `json:"prospect_num"`
	Niche               *string `json:"niche,omitempty"`
	PeringkatSekolah    *string `json:"peringkat_sekolah,omitempty"`
	Alamat              *string `json:"alamat,omitempty"`
	ProspectName        *string `json:"prospect_name,omitempty"`
	Pakej               *string `json:"pakej,omitempty"`
	NoFon               *string `json:"no_fon,omitempty"`
	CaraBayaran         *string `json:"cara_bayaran,omitempty"`
	TarikhGaji          *string `json:"tarikh_gaji,omitempty"`
	Stage               *string `json:"stage,omitempty"`
	ConvCurrent         *string `json:"conv_current,omitempty"`
	ConvLast            *string `json:"conv_last,omitempty"`
	CreatedAt           *string `json:"created_at,omitempty"`
	UpdatedAt           *string `json:"updated_at,omitempty"`
	Status              *string `json:"status,omitempty"`
}

// AIWhatsApp represents a record in ai_whatsapp table for Chatbot AI flows
type AIWhatsApp struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"user_id"`
	DeviceID     string                 `json:"id_device"` // Database column: id_device
	ProspectNum  string                 `json:"prospect_num"`
	Niche        string                 `json:"niche"`
	Stage        string                 `json:"stage"`
	Data         map[string]interface{} `json:"data"`
	CreatedAt    string                 `json:"created_at"`
	UpdatedAt    string                 `json:"updated_at"`
}
