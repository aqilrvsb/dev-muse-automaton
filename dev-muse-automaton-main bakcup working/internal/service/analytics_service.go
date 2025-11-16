package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"time"
)

// AnalyticsService handles analytics operations
type AnalyticsService struct {
	analyticsRepo *repository.AnalyticsRepository
	deviceRepo    *repository.DeviceRepository
}

// NewAnalyticsService creates a new analytics service
func NewAnalyticsService(analyticsRepo *repository.AnalyticsRepository, deviceRepo *repository.DeviceRepository) *AnalyticsService {
	return &AnalyticsService{
		analyticsRepo: analyticsRepo,
		deviceRepo:    deviceRepo,
	}
}

// GetDashboardMetrics retrieves overall dashboard analytics
func (s *AnalyticsService) GetDashboardMetrics(ctx context.Context, userID string, req *models.AnalyticsRequest) (*models.AnalyticsResponse, error) {
	// Set default time range if not provided (last 30 days)
	timeRange := req.TimeRange
	if timeRange == nil {
		now := time.Now()
		timeRange = &models.TimeRangeFilter{
			StartDate: now.AddDate(0, 0, -30),
			EndDate:   now,
		}
	}

	// Get conversation metrics
	conversationMetrics, err := s.analyticsRepo.GetConversationMetrics(ctx, req.DeviceID, timeRange)
	if err != nil {
		return &models.AnalyticsResponse{
			Success: false,
			Message: "Failed to retrieve conversation metrics",
			Error:   err.Error(),
		}, nil
	}

	// Get device metrics
	deviceMetrics, err := s.analyticsRepo.GetDeviceMetrics(ctx, userID)
	if err != nil {
		return &models.AnalyticsResponse{
			Success: false,
			Message: "Failed to retrieve device metrics",
			Error:   err.Error(),
		}, nil
	}

	// Get message metrics
	messageMetrics, err := s.analyticsRepo.GetMessageMetrics(ctx, req.DeviceID, timeRange)
	if err != nil {
		return &models.AnalyticsResponse{
			Success: false,
			Message: "Failed to retrieve message metrics",
			Error:   err.Error(),
		}, nil
	}

	dashboard := &models.DashboardMetrics{
		Conversations: conversationMetrics,
		Devices:       deviceMetrics,
		Messages:      messageMetrics,
		TimeRange:     timeRange,
	}

	return &models.AnalyticsResponse{
		Success: true,
		Message: "Dashboard metrics retrieved successfully",
		Data:    dashboard,
	}, nil
}

// GetConversationAnalytics retrieves conversation-specific analytics
func (s *AnalyticsService) GetConversationAnalytics(ctx context.Context, userID string, req *models.AnalyticsRequest) (*models.ConversationAnalyticsResponse, error) {
	// Verify device ownership if device ID is provided
	if req.DeviceID != "" {
		device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, req.DeviceID)
		if err != nil {
			device, err = s.deviceRepo.GetDeviceByID(ctx, req.DeviceID)
		}

		if err != nil || device == nil || device.UserID == nil || *device.UserID != userID {
			return &models.ConversationAnalyticsResponse{
				Success: false,
				Message: "Access denied: device not found or unauthorized",
			}, nil
		}
	}

	// Set default time range
	timeRange := req.TimeRange
	if timeRange == nil {
		now := time.Now()
		timeRange = &models.TimeRangeFilter{
			StartDate: now.AddDate(0, 0, -30),
			EndDate:   now,
		}
	}

	metrics, err := s.analyticsRepo.GetConversationMetrics(ctx, req.DeviceID, timeRange)
	if err != nil {
		return &models.ConversationAnalyticsResponse{
			Success: false,
			Message: "Failed to retrieve conversation analytics",
			Error:   err.Error(),
		}, nil
	}

	return &models.ConversationAnalyticsResponse{
		Success: true,
		Message: "Conversation analytics retrieved successfully",
		Data:    metrics,
	}, nil
}

// GetFlowAnalytics retrieves flow-specific analytics
func (s *AnalyticsService) GetFlowAnalytics(ctx context.Context, userID string, flowID string, timeRange *models.TimeRangeFilter) (*models.FlowAnalyticsResponse, error) {
	// Set default time range
	if timeRange == nil {
		now := time.Now()
		timeRange = &models.TimeRangeFilter{
			StartDate: now.AddDate(0, 0, -30),
			EndDate:   now,
		}
	}

	metrics, err := s.analyticsRepo.GetFlowMetrics(ctx, flowID, timeRange)
	if err != nil {
		return &models.FlowAnalyticsResponse{
			Success: false,
			Message: "Failed to retrieve flow analytics",
			Error:   err.Error(),
		}, nil
	}

	return &models.FlowAnalyticsResponse{
		Success: true,
		Message: "Flow analytics retrieved successfully",
		Data:    metrics,
	}, nil
}

// ExportAnalytics exports analytics data in specified format
func (s *AnalyticsService) ExportAnalytics(ctx context.Context, userID string, req *models.ExportRequest) (*models.ExportResponse, error) {
	// For now, return a placeholder
	// In production, this would generate CSV/JSON/XLSX files
	return &models.ExportResponse{
		Success:  true,
		Message:  "Export functionality coming soon",
		FileName: "analytics_export.csv",
	}, nil
}
