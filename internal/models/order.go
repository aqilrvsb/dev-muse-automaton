package models

import "time"

// Order represents a billing order in the system
type Order struct {
	ID           int       `json:"id,omitempty" db:"id"` // omitempty allows DB to auto-increment
	UserID       *string   `json:"user_id,omitempty" db:"user_id"`
	CollectionID *string   `json:"collection_id,omitempty" db:"collection_id"`
	BillID       *string   `json:"bill_id,omitempty" db:"bill_id"`
	Product      string    `json:"product" db:"product"`
	Method       string    `json:"method" db:"method"` // 'billplz' or 'cod'
	Amount       float64   `json:"amount" db:"amount"` // Amount in RM
	Status       string    `json:"status" db:"status"` // 'Pending', 'Processing', 'Success', 'Failed'
	URL          *string   `json:"url,omitempty" db:"url"` // Billplz payment URL
	CreatedAt    time.Time `json:"created_at,omitempty" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at,omitempty" db:"updated_at"`
}

// CreateOrderRequest is the request body for creating an order
type CreateOrderRequest struct {
	Product string `json:"product" validate:"required"`
	Method  string `json:"method" validate:"required,oneof=billplz cod"`
}

// OrderResponse is the response for order operations
type OrderResponse struct {
	Success bool    `json:"success"`
	Message string  `json:"message"`
	Order   *Order  `json:"order,omitempty"`
	URL     *string `json:"url,omitempty"` // Payment URL for billplz
}

// BillplzCreateBillRequest is the request to Billplz API
type BillplzCreateBillRequest struct {
	CollectionID    string `json:"collection_id"`
	Email           string `json:"email"`
	Mobile          string `json:"mobile,omitempty"`
	Name            string `json:"name"`
	Amount          int    `json:"amount"` // Amount in cents
	CallbackURL     string `json:"callback_url"`
	Description     string `json:"description"`
	RedirectURL     string `json:"redirect_url,omitempty"`
	Reference1Label string `json:"reference_1_label,omitempty"`
	Reference1      string `json:"reference_1,omitempty"`
}

// BillplzCreateBillResponse is the response from Billplz API
type BillplzCreateBillResponse struct {
	ID           string `json:"id"`
	CollectionID string `json:"collection_id"`
	Paid         bool   `json:"paid"`
	State        string `json:"state"`
	Amount       int    `json:"amount"`
	PaidAmount   int    `json:"paid_amount"`
	DueAt        string `json:"due_at"`
	Email        string `json:"email"`
	Mobile       string `json:"mobile"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	PaidAt       string `json:"paid_at"`
}

// BillplzCallbackPayload is the webhook callback from Billplz
type BillplzCallbackPayload struct {
	ID             string `json:"id" form:"id"`
	CollectionID   string `json:"collection_id" form:"collection_id"`
	Paid           string `json:"paid" form:"paid"`
	State          string `json:"state" form:"state"`
	Amount         string `json:"amount" form:"amount"`
	PaidAmount     string `json:"paid_amount" form:"paid_amount"`
	DueAt          string `json:"due_at" form:"due_at"`
	Email          string `json:"email" form:"email"`
	Mobile         string `json:"mobile" form:"mobile"`
	Name           string `json:"name" form:"name"`
	URL            string `json:"url" form:"url"`
	PaidAt         string `json:"paid_at" form:"paid_at"`
	XSignature     string `json:"x_signature" form:"x_signature"`
	TransactionID  string `json:"transaction_id" form:"transaction_id"`
	TransactionStatus string `json:"transaction_status" form:"transaction_status"`
}
