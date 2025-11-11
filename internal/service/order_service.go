package service

import (
	"bytes"
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// OrderService handles billing and payment business logic
type OrderService struct {
	orderRepo           *repository.OrderRepository
	userRepo            *repository.UserRepository
	billplzAPIKey       string
	billplzCollectionID string
	serverURL           string
}

// NewOrderService creates a new order service
func NewOrderService(
	orderRepo *repository.OrderRepository,
	userRepo *repository.UserRepository,
	billplzAPIKey string,
	billplzCollectionID string,
	serverURL string,
) *OrderService {
	return &OrderService{
		orderRepo:           orderRepo,
		userRepo:            userRepo,
		billplzAPIKey:       billplzAPIKey,
		billplzCollectionID: billplzCollectionID,
		serverURL:           serverURL,
	}
}

// CreateOrder creates a new order and initiates payment if method is billplz
func (s *OrderService) CreateOrder(ctx context.Context, userID string, req *models.CreateOrderRequest) (*models.OrderResponse, error) {
	// Get user information
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Validate user has gmail and phone before allowing purchase
	if user.Gmail == nil || *user.Gmail == "" {
		return &models.OrderResponse{
			Success: false,
			Message: "Please update your Gmail in Profile before making a purchase",
		}, nil
	}

	if user.Phone == nil || *user.Phone == "" {
		return &models.OrderResponse{
			Success: false,
			Message: "Please update your Phone Number in Profile before making a purchase",
		}, nil
	}

	// Extract amount from product string (format: "Package Name - RM XX.XX")
	amount := extractAmountFromProduct(req.Product)
	if amount <= 0 {
		return &models.OrderResponse{
			Success: false,
			Message: "Invalid product amount",
		}, nil
	}

	// Create order record
	order := &models.Order{
		UserID:  &userID,
		Product: req.Product,
		Method:  req.Method,
		Amount:  amount,
		Status:  "Pending",
	}

	// Save order to database
	if err := s.orderRepo.CreateOrder(ctx, order); err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	// If payment method is billplz, create bill
	if req.Method == "billplz" {
		billResp, err := s.createBillplzBill(ctx, order, user)
		if err != nil {
			// Update order status to failed
			s.orderRepo.UpdateOrderStatus(ctx, order.ID, "Failed")
			return nil, fmt.Errorf("failed to create Billplz bill: %w", err)
		}

		// Update order with Billplz data
		err = s.orderRepo.UpdateOrderBillplzData(
			ctx,
			order.ID,
			billResp.ID,
			billResp.CollectionID,
			billResp.URL,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to update order with Billplz data: %w", err)
		}

		// Update order object
		order.BillID = &billResp.ID
		order.CollectionID = &billResp.CollectionID
		order.URL = &billResp.URL

		return &models.OrderResponse{
			Success: true,
			Message: "Order created successfully. Please proceed to payment.",
			Order:   order,
			URL:     &billResp.URL,
		}, nil
	}

	// For COD method
	return &models.OrderResponse{
		Success: true,
		Message: "Order created successfully with Cash on Delivery.",
		Order:   order,
	}, nil
}

// createBillplzBill creates a bill in Billplz
func (s *OrderService) createBillplzBill(ctx context.Context, order *models.Order, user *models.User) (*models.BillplzCreateBillResponse, error) {
	// Convert amount to cents (RM 100.00 = 10000 cents)
	amountInCents := int(order.Amount * 100)

	// Prepare request data
	requestData := map[string]interface{}{
		"collection_id": s.billplzCollectionID,
		"email":         user.Email,
		"name":          user.FullName,
		"amount":        amountInCents,
		"callback_url":  fmt.Sprintf("%s/api/billing/callback", s.serverURL),
		"description":   order.Product,
	}

	// Add phone if available
	if user.Phone != nil && *user.Phone != "" {
		requestData["mobile"] = *user.Phone
	}

	// Convert to JSON
	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		"https://www.billplz.com/api/v3/bills",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.SetBasicAuth(s.billplzAPIKey, "")
	req.Header.Set("Content-Type", "application/json")

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("billplz API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var billResp models.BillplzCreateBillResponse
	if err := json.Unmarshal(body, &billResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &billResp, nil
}

// GetUserOrders retrieves all orders for a user
func (s *OrderService) GetUserOrders(ctx context.Context, userID string) ([]models.Order, error) {
	orders, err := s.orderRepo.GetOrdersByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user orders: %w", err)
	}
	return orders, nil
}

// GetUserOrdersFiltered retrieves orders for a user with date filtering
func (s *OrderService) GetUserOrdersFiltered(ctx context.Context, userID, fromDate, toDate string) ([]models.Order, error) {
	orders, err := s.orderRepo.GetOrdersByUserIDFiltered(ctx, userID, fromDate, toDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get filtered user orders: %w", err)
	}
	return orders, nil
}

// GetAllOrdersFiltered retrieves all orders with date filtering (admin only)
func (s *OrderService) GetAllOrdersFiltered(ctx context.Context, fromDate, toDate string) ([]models.Order, error) {
	orders, err := s.orderRepo.GetAllOrdersFiltered(ctx, fromDate, toDate)
	if err != nil {
		return nil, fmt.Errorf("failed to get filtered orders: %w", err)
	}
	return orders, nil
}

// GetOrderByID retrieves an order by ID
func (s *OrderService) GetOrderByID(ctx context.Context, id int, userID string) (*models.Order, error) {
	order, err := s.orderRepo.GetOrderByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	// Verify order belongs to user
	if order.UserID == nil || *order.UserID != userID {
		return nil, fmt.Errorf("unauthorized access to order")
	}

	return order, nil
}

// HandleBillplzCallback processes Billplz payment callback
func (s *OrderService) HandleBillplzCallback(ctx context.Context, callback *models.BillplzCallbackPayload) error {
	// Get order by bill ID
	order, err := s.orderRepo.GetOrderByBillID(ctx, callback.ID)
	if err != nil {
		return fmt.Errorf("failed to get order: %w", err)
	}

	// Update order status based on payment status
	if callback.Paid == "true" {
		err = s.orderRepo.UpdateOrderPaymentComplete(ctx, callback.ID)
		if err != nil {
			return fmt.Errorf("failed to update order as successful: %w", err)
		}

		// Upgrade user to Pro status with 30-day expiration
		if order.UserID != nil {
			// Calculate expiration: today + 29 days (30 days total including today)
			expirationDate := time.Now().AddDate(0, 0, 29)

			err = s.userRepo.UpgradeUserToPro(ctx, *order.UserID, expirationDate)
			if err != nil {
				// Log error but don't fail the callback
				// Order is already marked as successful
				fmt.Printf("Warning: Failed to upgrade user %s to Pro: %v\n", *order.UserID, err)
			} else {
				fmt.Printf("✅ User %s upgraded to Pro until %s\n", *order.UserID, expirationDate.Format("2006-01-02"))
			}
		}

	} else {
		err = s.orderRepo.UpdateOrderPaymentFailed(ctx, callback.ID)
		if err != nil {
			return fmt.Errorf("failed to update order as failed: %w", err)
		}
	}

	return nil
}

// GetAllOrders retrieves all orders (for admin)
func (s *OrderService) GetAllOrders(ctx context.Context) ([]models.Order, error) {
	orders, err := s.orderRepo.GetAllOrders(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get all orders: %w", err)
	}
	return orders, nil
}

// extractAmountFromProduct extracts the price amount from product string
// Expected format: "Package Name - RM XX.XX" or "Package Name - RM XXX.XX"
func extractAmountFromProduct(product string) float64 {
	// Split by " - RM " to get the amount part
	parts := strings.Split(product, " - RM ")
	if len(parts) < 2 {
		return 0
	}

	// Get the amount string (last part)
	amountStr := strings.TrimSpace(parts[len(parts)-1])

	// Parse the amount to float64
	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		return 0
	}

	return amount
}
