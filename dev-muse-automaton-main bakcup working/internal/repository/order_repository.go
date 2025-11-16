package repository

import (
	"chatbot-automation/internal/database"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// OrderRepository handles order data operations
type OrderRepository struct {
	supabase *database.SupabaseClient
}

// NewOrderRepository creates a new order repository
func NewOrderRepository(supabase *database.SupabaseClient) *OrderRepository {
	return &OrderRepository{
		supabase: supabase,
	}
}

// CreateOrder creates a new order
func (r *OrderRepository) CreateOrder(ctx context.Context, order *models.Order) error {
	// Set timestamps
	order.CreatedAt = time.Now()
	order.UpdatedAt = time.Now()

	// Insert using service role (bypasses RLS)
	data, err := r.supabase.InsertAsAdmin("orders", order)
	if err != nil {
		return fmt.Errorf("failed to create order: %w", err)
	}

	// Parse response to get created order
	var orders []models.Order
	if err := json.Unmarshal(data, &orders); err != nil {
		return fmt.Errorf("failed to parse created order: %w", err)
	}

	if len(orders) > 0 {
		*order = orders[0]
	}

	return nil
}

// GetOrderByID retrieves an order by ID
func (r *OrderRepository) GetOrderByID(ctx context.Context, id int) (*models.Order, error) {
	data, err := r.supabase.QueryAsAdmin("orders", map[string]string{
		"select": "*",
		"id":     fmt.Sprintf("eq.%d", id),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get order: %w", err)
	}

	var orders []models.Order
	if err := json.Unmarshal(data, &orders); err != nil {
		return nil, fmt.Errorf("failed to parse order: %w", err)
	}

	if len(orders) == 0 {
		return nil, fmt.Errorf("order not found")
	}

	return &orders[0], nil
}

// GetOrderByBillID retrieves an order by Billplz bill ID
func (r *OrderRepository) GetOrderByBillID(ctx context.Context, billID string) (*models.Order, error) {
	data, err := r.supabase.QueryAsAdmin("orders", map[string]string{
		"select":  "*",
		"bill_id": fmt.Sprintf("eq.%s", billID),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get order by bill ID: %w", err)
	}

	var orders []models.Order
	if err := json.Unmarshal(data, &orders); err != nil {
		return nil, fmt.Errorf("failed to parse order: %w", err)
	}

	if len(orders) == 0 {
		return nil, fmt.Errorf("order not found")
	}

	return &orders[0], nil
}

// GetOrdersByUserID retrieves all orders for a user
func (r *OrderRepository) GetOrdersByUserID(ctx context.Context, userID string) ([]models.Order, error) {
	data, err := r.supabase.QueryAsAdmin("orders", map[string]string{
		"select":  "*",
		"user_id": fmt.Sprintf("eq.%s", userID),
		"order":   "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get orders: %w", err)
	}

	var orders []models.Order
	if err := json.Unmarshal(data, &orders); err != nil {
		return nil, fmt.Errorf("failed to parse orders: %w", err)
	}

	return orders, nil
}

// UpdateOrderStatus updates an order's status
func (r *OrderRepository) UpdateOrderStatus(ctx context.Context, id int, status string) error {
	update := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}

	filter := map[string]string{
		"id": fmt.Sprintf("%d", id),
	}

	_, err := r.supabase.UpdateAsAdmin("orders", filter, update)
	if err != nil {
		return fmt.Errorf("failed to update order status: %w", err)
	}

	return nil
}

// UpdateOrderBillplzData updates order with Billplz data
func (r *OrderRepository) UpdateOrderBillplzData(ctx context.Context, id int, billID, collectionID, url string) error {
	update := map[string]interface{}{
		"bill_id":       billID,
		"collection_id": collectionID,
		"url":           url,
		"updated_at":    time.Now(),
	}

	filter := map[string]string{
		"id": fmt.Sprintf("%d", id),
	}

	_, err := r.supabase.UpdateAsAdmin("orders", filter, update)
	if err != nil {
		return fmt.Errorf("failed to update order Billplz data: %w", err)
	}

	return nil
}

// UpdateOrderPaymentComplete marks order as successful
func (r *OrderRepository) UpdateOrderPaymentComplete(ctx context.Context, billID string) error {
	update := map[string]interface{}{
		"status":     "Success",
		"updated_at": time.Now(),
	}

	filter := map[string]string{
		"bill_id": billID,
	}

	_, err := r.supabase.UpdateAsAdmin("orders", filter, update)
	if err != nil {
		return fmt.Errorf("failed to update order payment: %w", err)
	}

	return nil
}

// UpdateOrderPaymentFailed marks order as failed
func (r *OrderRepository) UpdateOrderPaymentFailed(ctx context.Context, billID string) error {
	update := map[string]interface{}{
		"status":     "Failed",
		"updated_at": time.Now(),
	}

	filter := map[string]string{
		"bill_id": billID,
	}

	_, err := r.supabase.UpdateAsAdmin("orders", filter, update)
	if err != nil {
		return fmt.Errorf("failed to update order payment: %w", err)
	}

	return nil
}

// GetAllOrders retrieves all orders (for admin)
func (r *OrderRepository) GetAllOrders(ctx context.Context) ([]models.Order, error) {
	data, err := r.supabase.QueryAsAdmin("orders", map[string]string{
		"select": "*",
		"order":  "created_at.desc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get all orders: %w", err)
	}

	var orders []models.Order
	if err := json.Unmarshal(data, &orders); err != nil {
		return nil, fmt.Errorf("failed to parse orders: %w", err)
	}

	return orders, nil
}
