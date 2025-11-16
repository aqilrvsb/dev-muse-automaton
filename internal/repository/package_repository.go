package repository

import (
	"chatbot-automation/internal/database"
	"chatbot-automation/internal/models"
	"context"
	"encoding/json"
	"fmt"
)

// PackageRepository handles package data operations
type PackageRepository struct {
	supabase *database.SupabaseClient
}

// NewPackageRepository creates a new package repository
func NewPackageRepository(supabase *database.SupabaseClient) *PackageRepository {
	return &PackageRepository{
		supabase: supabase,
	}
}

// CreatePackage creates a new package in the database
func (r *PackageRepository) CreatePackage(ctx context.Context, pkg *models.Package) error {
	data, err := r.supabase.InsertAsAdmin("packages", map[string]interface{}{
		"name":   pkg.Name,
		"amount": pkg.Amount,
	})
	if err != nil {
		return fmt.Errorf("failed to create package: %w", err)
	}

	var createdPackages []models.Package
	if err := json.Unmarshal(data, &createdPackages); err != nil {
		return fmt.Errorf("failed to parse created package: %w", err)
	}

	if len(createdPackages) > 0 {
		*pkg = createdPackages[0]
	}

	return nil
}

// GetAllPackages retrieves all packages from the database
func (r *PackageRepository) GetAllPackages(ctx context.Context) ([]models.Package, error) {
	data, err := r.supabase.QueryAsAdmin("packages", map[string]string{
		"select": "*",
		"order":  "id.asc",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get packages: %w", err)
	}

	var packages []models.Package
	if err := json.Unmarshal(data, &packages); err != nil {
		return nil, fmt.Errorf("failed to parse packages: %w", err)
	}

	// Return empty slice instead of nil
	if packages == nil {
		packages = make([]models.Package, 0)
	}

	return packages, nil
}

// GetPackageByID retrieves a package by ID
func (r *PackageRepository) GetPackageByID(ctx context.Context, id int) (*models.Package, error) {
	data, err := r.supabase.QueryAsAdmin("packages", map[string]string{
		"select": "*",
		"id":     fmt.Sprintf("eq.%d", id),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get package: %w", err)
	}

	var packages []models.Package
	if err := json.Unmarshal(data, &packages); err != nil {
		return nil, fmt.Errorf("failed to parse package: %w", err)
	}

	if len(packages) == 0 {
		return nil, fmt.Errorf("package not found")
	}

	return &packages[0], nil
}

// UpdatePackage updates an existing package
func (r *PackageRepository) UpdatePackage(ctx context.Context, id int, pkg *models.Package) error {
	data, err := r.supabase.UpdateAsAdmin("packages", map[string]string{
		"id": fmt.Sprintf("%d", id),
	}, map[string]interface{}{
		"name":   pkg.Name,
		"amount": pkg.Amount,
	})
	if err != nil {
		return fmt.Errorf("failed to update package: %w", err)
	}

	var updatedPackages []models.Package
	if err := json.Unmarshal(data, &updatedPackages); err != nil {
		return fmt.Errorf("failed to parse updated package: %w", err)
	}

	if len(updatedPackages) > 0 {
		*pkg = updatedPackages[0]
	}

	return nil
}

// DeletePackage deletes a package by ID
func (r *PackageRepository) DeletePackage(ctx context.Context, id int) error {
	err := r.supabase.DeleteAsAdmin("packages", map[string]string{
		"id": fmt.Sprintf("%d", id),
	})
	if err != nil {
		return fmt.Errorf("failed to delete package: %w", err)
	}

	return nil
}
