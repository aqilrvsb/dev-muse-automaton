package handler

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/service"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// PackageHandler handles package-related HTTP requests
type PackageHandler struct {
	packageService *service.PackageService
	authService    *service.AuthService
}

// NewPackageHandler creates a new package handler
func NewPackageHandler(packageService *service.PackageService, authService *service.AuthService) *PackageHandler {
	return &PackageHandler{
		packageService: packageService,
		authService:    authService,
	}
}

// getUserIDFromToken extracts user ID from JWT token in Authorization header
func (h *PackageHandler) getUserIDFromToken(c *fiber.Ctx) (string, error) {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Authorization header required")
	}

	// Extract token from "Bearer <token>"
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

// CreatePackage creates a new package (admin only)
// POST /api/packages
func (h *PackageHandler) CreatePackage(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Check if user is admin
	isAdmin, err := h.authService.IsAdmin(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to check admin status",
			"error":   err.Error(),
		})
	}

	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Only admins can create packages",
		})
	}

	// Parse request body
	var req models.CreatePackageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// Create package
	resp, err := h.packageService.CreatePackage(c.Context(), &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to create package",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusBadRequest).JSON(resp)
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// GetAllPackages retrieves all packages (available to all authenticated users)
// GET /api/packages
func (h *PackageHandler) GetAllPackages(c *fiber.Ctx) error {
	// Get user ID from token (just for authentication check)
	_, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Get all packages (no admin check - all users can view packages)
	resp, err := h.packageService.GetAllPackages(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get packages",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// GetPackageByID retrieves a package by ID (admin only)
// GET /api/packages/:id
func (h *PackageHandler) GetPackageByID(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Check if user is admin
	isAdmin, err := h.authService.IsAdmin(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to check admin status",
			"error":   err.Error(),
		})
	}

	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Only admins can view packages",
		})
	}

	// Get package ID from URL parameter
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid package ID",
		})
	}

	// Get package
	resp, err := h.packageService.GetPackageByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to get package",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// UpdatePackage updates an existing package (admin only)
// PUT /api/packages/:id
func (h *PackageHandler) UpdatePackage(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Check if user is admin
	isAdmin, err := h.authService.IsAdmin(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to check admin status",
			"error":   err.Error(),
		})
	}

	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Only admins can update packages",
		})
	}

	// Get package ID from URL parameter
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid package ID",
		})
	}

	// Parse request body
	var req models.UpdatePackageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid request body",
		})
	}

	// Update package
	resp, err := h.packageService.UpdatePackage(c.Context(), id, &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to update package",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusBadRequest).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}

// DeletePackage deletes a package (admin only)
// DELETE /api/packages/:id
func (h *PackageHandler) DeletePackage(c *fiber.Ctx) error {
	// Get user ID from token
	userID, err := h.getUserIDFromToken(c)
	if err != nil {
		return err
	}

	// Check if user is admin
	isAdmin, err := h.authService.IsAdmin(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to check admin status",
			"error":   err.Error(),
		})
	}

	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"success": false,
			"message": "Only admins can delete packages",
		})
	}

	// Get package ID from URL parameter
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid package ID",
		})
	}

	// Delete package
	resp, err := h.packageService.DeletePackage(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"message": "Failed to delete package",
			"error":   err.Error(),
		})
	}

	if !resp.Success {
		return c.Status(fiber.StatusNotFound).JSON(resp)
	}

	return c.Status(fiber.StatusOK).JSON(resp)
}
