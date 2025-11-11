package models

import "time"

// Package represents a billing package in the system
type Package struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Amount    string    `json:"amount"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreatePackageRequest represents the request to create a new package
type CreatePackageRequest struct {
	Name   string `json:"name"`
	Amount string `json:"amount"`
}

// UpdatePackageRequest represents the request to update a package
type UpdatePackageRequest struct {
	Name   string `json:"name"`
	Amount string `json:"amount"`
}

// PackageResponse represents the response for package operations
type PackageResponse struct {
	Success bool      `json:"success"`
	Message string    `json:"message"`
	Package *Package  `json:"package,omitempty"`
	Packages []Package `json:"packages,omitempty"`
}
