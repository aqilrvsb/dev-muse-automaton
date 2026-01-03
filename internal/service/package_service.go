package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"fmt"
)

// PackageService handles package business logic
type PackageService struct {
	packageRepo *repository.PackageRepository
}

// NewPackageService creates a new package service
func NewPackageService(packageRepo *repository.PackageRepository) *PackageService {
	return &PackageService{
		packageRepo: packageRepo,
	}
}

// CreatePackage creates a new package
func (s *PackageService) CreatePackage(ctx context.Context, req *models.CreatePackageRequest) (*models.PackageResponse, error) {
	// Validate input
	if req.Name == "" {
		return &models.PackageResponse{
			Success: false,
			Message: "Package name is required",
		}, nil
	}

	if req.Amount == "" {
		return &models.PackageResponse{
			Success: false,
			Message: "Package amount is required",
		}, nil
	}

	// Create package
	pkg := &models.Package{
		Name:   req.Name,
		Amount: req.Amount,
	}

	if err := s.packageRepo.CreatePackage(ctx, pkg); err != nil {
		return nil, fmt.Errorf("failed to create package: %w", err)
	}

	return &models.PackageResponse{
		Success: true,
		Message: "Package created successfully",
		Package: pkg,
	}, nil
}

// GetAllPackages retrieves all packages
func (s *PackageService) GetAllPackages(ctx context.Context) (*models.PackageResponse, error) {
	packages, err := s.packageRepo.GetAllPackages(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get packages: %w", err)
	}

	return &models.PackageResponse{
		Success:  true,
		Message:  fmt.Sprintf("Found %d packages", len(packages)),
		Packages: packages,
	}, nil
}

// GetPackageByID retrieves a package by ID
func (s *PackageService) GetPackageByID(ctx context.Context, id int) (*models.PackageResponse, error) {
	pkg, err := s.packageRepo.GetPackageByID(ctx, id)
	if err != nil {
		return &models.PackageResponse{
			Success: false,
			Message: "Package not found",
		}, nil
	}

	return &models.PackageResponse{
		Success: true,
		Message: "Package retrieved successfully",
		Package: pkg,
	}, nil
}

// UpdatePackage updates an existing package
func (s *PackageService) UpdatePackage(ctx context.Context, id int, req *models.UpdatePackageRequest) (*models.PackageResponse, error) {
	// Validate input
	if req.Name == "" {
		return &models.PackageResponse{
			Success: false,
			Message: "Package name is required",
		}, nil
	}

	if req.Amount == "" {
		return &models.PackageResponse{
			Success: false,
			Message: "Package amount is required",
		}, nil
	}

	// Check if package exists
	existingPkg, err := s.packageRepo.GetPackageByID(ctx, id)
	if err != nil {
		return &models.PackageResponse{
			Success: false,
			Message: "Package not found",
		}, nil
	}

	// Update package
	existingPkg.Name = req.Name
	existingPkg.Amount = req.Amount

	if err := s.packageRepo.UpdatePackage(ctx, id, existingPkg); err != nil {
		return nil, fmt.Errorf("failed to update package: %w", err)
	}

	return &models.PackageResponse{
		Success: true,
		Message: "Package updated successfully",
		Package: existingPkg,
	}, nil
}

// DeletePackage deletes a package
func (s *PackageService) DeletePackage(ctx context.Context, id int) (*models.PackageResponse, error) {
	// Check if package exists
	_, err := s.packageRepo.GetPackageByID(ctx, id)
	if err != nil {
		return &models.PackageResponse{
			Success: false,
			Message: "Package not found",
		}, nil
	}

	// Delete package
	if err := s.packageRepo.DeletePackage(ctx, id); err != nil {
		return nil, fmt.Errorf("failed to delete package: %w", err)
	}

	return &models.PackageResponse{
		Success: true,
		Message: "Package deleted successfully",
	}, nil
}
