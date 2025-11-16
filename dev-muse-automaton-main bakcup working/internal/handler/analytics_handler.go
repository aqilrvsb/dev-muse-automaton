package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"

	"github.com/gofiber/fiber/v2"
)

// AnalyticsHandler handles analytics HTTP requests
type AnalyticsHandler struct {
	analyticsService *service.AnalyticsService
	authService      *service.AuthService
}

// NewAnalyticsHandler creates a new analytics handler
func NewAnalyticsHandler(analyticsService *service.AnalyticsService, authService *service.AuthService) *AnalyticsHandler {
	return &AnalyticsHandler{
		analyticsService: analyticsService,
		authService:      authService,
	}
}

// GetDashboard retrieves overall dashboard metrics
// GET /api/analytics/dashboard
func (h *AnalyticsHandler) GetDashboard(c *fiber.Ctx) error {
	// Extract JWT
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Missing authorization token",
		})
	}

	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
		})
	}

	userID := claims.UserID

	// Parse query parameters
	var req models.AnalyticsRequest
	if err := c.QueryParser(&req); err != nil {
		// Ignore parsing errors for optional query params
	}

	// Get dashboard metrics
	response, err := h.analyticsService.GetDashboardMetrics(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve dashboard metrics",
			"error":   err.Error(),
		})
	}

	if !response.Success {
		return c.Status(fiber.StatusBadRequest).JSON(response)
	}

	return c.JSON(response)
}

// GetConversationAnalytics retrieves conversation analytics
// GET /api/analytics/conversations
func (h *AnalyticsHandler) GetConversationAnalytics(c *fiber.Ctx) error {
	// Extract JWT
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Missing authorization token",
		})
	}

	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
		})
	}

	userID := claims.UserID

	// Parse query parameters
	var req models.AnalyticsRequest
	if err := c.QueryParser(&req); err != nil {
		// Ignore parsing errors
	}

	// Get conversation analytics
	response, err := h.analyticsService.GetConversationAnalytics(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve conversation analytics",
			"error":   err.Error(),
		})
	}

	if !response.Success {
		return c.Status(fiber.StatusForbidden).JSON(response)
	}

	return c.JSON(response)
}

// GetFlowAnalytics retrieves flow-specific analytics
// GET /api/analytics/flows/:flowId
func (h *AnalyticsHandler) GetFlowAnalytics(c *fiber.Ctx) error {
	// Extract JWT
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Missing authorization token",
		})
	}

	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
		})
	}

	userID := claims.UserID
	flowID := c.Params("flowId")

	if flowID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Flow ID is required",
		})
	}

	// Get flow analytics
	response, err := h.analyticsService.GetFlowAnalytics(c.Context(), userID, flowID, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to retrieve flow analytics",
			"error":   err.Error(),
		})
	}

	if !response.Success {
		return c.Status(fiber.StatusBadRequest).JSON(response)
	}

	return c.JSON(response)
}

// ExportAnalytics exports analytics data
// POST /api/analytics/export
func (h *AnalyticsHandler) ExportAnalytics(c *fiber.Ctx) error {
	// Extract JWT
	token := c.Get("Authorization")
	if token == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Missing authorization token",
		})
	}

	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
		})
	}

	userID := claims.UserID

	// Parse request
	var req models.ExportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate format
	if req.Format == "" {
		req.Format = "csv"
	}

	// Export analytics
	response, err := h.analyticsService.ExportAnalytics(c.Context(), userID, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to export analytics",
			"error":   err.Error(),
		})
	}

	return c.JSON(response)
}
