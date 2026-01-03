package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"

	"github.com/gofiber/fiber/v2"
)

// AuthHandler handles authentication HTTP requests
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates a new authentication handler
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// Register handles user registration
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req models.RegisterRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate required fields
	if req.Email == "" || req.FullName == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Email, full name, and password are required",
		})
	}

	// Validate password length
	if len(req.Password) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Password must be at least 8 characters long",
		})
	}

	// Call service
	resp, err := h.authService.Register(c.Context(), &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to register user",
			"error":   err.Error(),
		})
	}

	// If user already exists
	if !resp.Success {
		return c.Status(fiber.StatusConflict).JSON(resp)
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// Login handles user login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Email and password are required",
		})
	}

	// Call service
	resp, err := h.authService.Login(c.Context(), &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to login",
			"error":   err.Error(),
		})
	}

	// If login failed (wrong credentials or disabled account)
	if !resp.Success {
		return c.Status(fiber.StatusUnauthorized).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetProfile handles getting the current user's profile
func (h *AuthHandler) GetProfile(c *fiber.Ctx) error {
	// Get token from Authorization header
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Authorization header required",
		})
	}

	// Extract token (assuming "Bearer <token>" format)
	token := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}

	// Get user by token
	user, err := h.authService.GetUserByToken(c.Context(), token)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Invalid or expired token",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"user":    user,
	})
}

// ChangePassword handles changing user password
func (h *AuthHandler) ChangePassword(c *fiber.Ctx) error {
	// Get token from Authorization header
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Authorization header required",
		})
	}

	// Extract token
	token := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}

	var req models.ChangePasswordRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Validate required fields
	if req.CurrentPassword == "" || req.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Current password and new password are required",
		})
	}

	// Validate new password length
	if len(req.NewPassword) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "New password must be at least 6 characters long",
		})
	}

	// Call service
	resp, err := h.authService.ChangePassword(c.Context(), token, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to change password",
			"error":   err.Error(),
		})
	}

	// If password change failed
	if !resp.Success {
		return c.Status(fiber.StatusUnauthorized).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// UpdateProfile handles updating user profile (gmail and phone)
func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	// Get token from Authorization header
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Authorization header required",
		})
	}

	// Extract token
	token := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		token = authHeader[7:]
	}

	var req models.UpdateProfileRequest

	// Parse request body
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
	}

	// Call service
	resp, err := h.authService.UpdateProfile(c.Context(), token, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to update profile",
			"error":   err.Error(),
		})
	}

	// If update failed
	if !resp.Success {
		return c.Status(fiber.StatusUnauthorized).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
