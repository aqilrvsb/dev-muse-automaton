package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// OrderHandler handles billing and payment HTTP requests
type OrderHandler struct {
	orderService *service.OrderService
	authService  *service.AuthService
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(orderService *service.OrderService, authService *service.AuthService) *OrderHandler {
	return &OrderHandler{
		orderService: orderService,
		authService:  authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token
func (h *OrderHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Authorization header required")
	}

	// Extract token
	token := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}

	// Validate token
	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Invalid or expired token")
	}

	return claims.UserID, nil
}

// CreateOrder handles order creation
func (h *OrderHandler) CreateOrder(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	var req models.CreateOrderRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate required fields
	if req.Product == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Product is required",
		})
	}

	if req.Method != "billplz" && req.Method != "cod" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Payment method must be 'billplz' or 'cod'",
		})
	}

	// Create order
	resp, err := h.orderService.CreateOrder(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to create order",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GetUserOrders retrieves all orders for the authenticated user
func (h *OrderHandler) GetUserOrders(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	orders, err := h.orderService.GetUserOrders(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve orders",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    orders,
	})
}

// GetOrderByID retrieves a specific order by ID
func (h *OrderHandler) GetOrderByID(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get order ID from params
	orderIDStr := c.Params("id")
	orderID, err := strconv.Atoi(orderIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid order ID",
		})
	}

	order, err := h.orderService.GetOrderByID(c.Context(), orderID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve order",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    order,
	})
}

// BillplzCallback handles payment callback from Billplz
func (h *OrderHandler) BillplzCallback(c *fiber.Ctx) error {
	var callback models.BillplzCallbackPayload

	// Parse form data
	if err := c.BodyParser(&callback); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid callback data",
			"error":   err.Error(),
		})
	}

	// Note: X-Signature verification skipped (not used in PHP version)
	// For production, implement signature verification for security

	// Process callback
	if err := h.orderService.HandleBillplzCallback(c.Context(), &callback); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to process callback",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Callback processed successfully",
	})
}

// GetAllOrders retrieves all orders (admin only)
func (h *OrderHandler) GetAllOrders(c *fiber.Ctx) error {
	orders, err := h.orderService.GetAllOrders(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve orders",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    orders,
	})
}
