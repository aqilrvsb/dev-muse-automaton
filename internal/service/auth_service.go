package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"chatbot-automation/internal/utils"
	"context"
	"fmt"
	"time"
)

// AuthService handles authentication business logic
type AuthService struct {
	userRepo  *repository.UserRepository
	jwtSecret string
}

// NewAuthService creates a new authentication service
func NewAuthService(userRepo *repository.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

// Register registers a new user
func (s *AuthService) Register(ctx context.Context, req *models.RegisterRequest) (*models.AuthResponse, error) {
	// Check if user already exists
	existingUser, _ := s.userRepo.GetUserByEmail(ctx, req.Email)
	if existingUser != nil {
		return &models.AuthResponse{
			Success: false,
			Message: "User with this email already exists",
		}, nil
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Set expiration date to current date (Free users start with today's date as YYYY-MM-DD)
	currentDate := time.Now().Format("2006-01-02")

	// Create user
	user := &models.User{
		Email:    req.Email,
		FullName: req.FullName,
		Password: hashedPassword,
		Expired:  &currentDate,
	}

	if err := s.userRepo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Generate JWT token
	token, err := utils.GenerateJWT(user.ID, user.Email, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Create session with random token
	sessionToken, err := utils.GenerateRandomToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate session token: %w", err)
	}

	session := &models.UserSession{
		UserID: user.ID,
		Token:  sessionToken,
	}

	if err := s.userRepo.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Remove password from response
	user.Password = ""

	return &models.AuthResponse{
		Success: true,
		Message: "User registered successfully",
		Token:   token,
		User:    user,
	}, nil
}

// Login authenticates a user and returns a token
func (s *AuthService) Login(ctx context.Context, req *models.LoginRequest) (*models.AuthResponse, error) {
	// Get user by email
	user, err := s.userRepo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return &models.AuthResponse{
			Success: false,
			Message: "Invalid email or password",
		}, nil
	}

	// Check if user is active
	if !user.IsActive {
		return &models.AuthResponse{
			Success: false,
			Message: "Account is disabled",
		}, nil
	}

	// Verify password
	if !utils.CheckPassword(user.Password, req.Password) {
		return &models.AuthResponse{
			Success: false,
			Message: "Invalid email or password",
		}, nil
	}

	// Update last login
	if err := s.userRepo.UpdateLastLogin(ctx, user.ID); err != nil {
		// Log error but don't fail the login
		fmt.Printf("Failed to update last login: %v\n", err)
	}

	// Generate JWT token
	token, err := utils.GenerateJWT(user.ID, user.Email, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Create session
	sessionToken, err := utils.GenerateRandomToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate session token: %w", err)
	}

	session := &models.UserSession{
		UserID: user.ID,
		Token:  sessionToken,
	}

	if err := s.userRepo.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Remove password from response
	user.Password = ""

	return &models.AuthResponse{
		Success: true,
		Message: "Login successful",
		Token:   token,
		User:    user,
	}, nil
}

// ValidateToken validates a JWT token
func (s *AuthService) ValidateToken(tokenString string) (*utils.JWTClaims, error) {
	return utils.ValidateJWT(tokenString, s.jwtSecret)
}

// GetUserByToken retrieves a user by their JWT token
func (s *AuthService) GetUserByToken(ctx context.Context, tokenString string) (*models.User, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	user, err := s.userRepo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Remove password from response
	user.Password = ""

	return user, nil
}

// ChangePassword changes a user's password
func (s *AuthService) ChangePassword(ctx context.Context, tokenString string, req *models.ChangePasswordRequest) (*models.AuthResponse, error) {
	// Validate token and get user
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return &models.AuthResponse{
			Success: false,
			Message: "Invalid or expired token",
		}, nil
	}

	// Get user from database
	user, err := s.userRepo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return &models.AuthResponse{
			Success: false,
			Message: "User not found",
		}, nil
	}

	// Verify current password
	if !utils.CheckPassword(user.Password, req.CurrentPassword) {
		return &models.AuthResponse{
			Success: false,
			Message: "Current password is incorrect",
		}, nil
	}

	// Hash new password
	hashedPassword, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password in database
	if err := s.userRepo.UpdatePassword(ctx, user.ID, hashedPassword); err != nil {
		return nil, fmt.Errorf("failed to update password: %w", err)
	}

	return &models.AuthResponse{
		Success: true,
		Message: "Password changed successfully",
	}, nil
}

// UpdateProfile updates user profile (gmail and phone)
func (s *AuthService) UpdateProfile(ctx context.Context, tokenString string, req *models.UpdateProfileRequest) (*models.AuthResponse, error) {
	// Validate token and get user
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return &models.AuthResponse{
			Success: false,
			Message: "Invalid or expired token",
		}, nil
	}

	// Update profile in database
	if err := s.userRepo.UpdateProfile(ctx, claims.UserID, req.Gmail, req.Phone); err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}

	return &models.AuthResponse{
		Success: true,
		Message: "Profile updated successfully",
	}, nil
}

// IsAdmin checks if a user is an admin based on their email
func (s *AuthService) IsAdmin(ctx context.Context, userID string) (bool, error) {
	user, err := s.userRepo.GetUserByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	// Check if user email is Admin@gmail.com (case-insensitive)
	return user.Email == "Admin@gmail.com" || user.Role == "admin", nil
}
