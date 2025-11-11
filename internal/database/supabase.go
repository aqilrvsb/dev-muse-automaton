package database

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// SupabaseClient provides access to Supabase REST API
type SupabaseClient struct {
	URL        string
	AnonKey    string
	ServiceKey string
	HTTPClient *http.Client
}

// NewSupabaseClient creates a new Supabase client
func NewSupabaseClient(url, anonKey, serviceKey string) *SupabaseClient {
	return &SupabaseClient{
		URL:        url,
		AnonKey:    anonKey,
		ServiceKey: serviceKey,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Query executes a SELECT query on a table (uses anon key, RLS applies)
func (s *SupabaseClient) Query(table string, params map[string]string) ([]byte, error) {
	return s.queryWithKey(table, params, s.AnonKey)
}

// QueryAsAdmin executes a SELECT query on a table using service role key (bypasses RLS)
func (s *SupabaseClient) QueryAsAdmin(table string, params map[string]string) ([]byte, error) {
	return s.queryWithKey(table, params, s.ServiceKey)
}

// queryWithKey executes a SELECT query with a specific API key
func (s *SupabaseClient) queryWithKey(table string, params map[string]string, apiKey string) ([]byte, error) {
	url := fmt.Sprintf("%s/rest/v1/%s", s.URL, table)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Add query parameters
	q := req.URL.Query()
	for key, value := range params {
		q.Add(key, value)
	}
	req.URL.RawQuery = q.Encode()

	// Add headers
	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase error: %s - %s", resp.Status, string(body))
	}

	return body, nil
}

// Insert inserts a new record into a table (uses anon key, RLS applies)
func (s *SupabaseClient) Insert(table string, data interface{}) ([]byte, error) {
	return s.insertWithKey(table, data, s.AnonKey)
}

// InsertAsAdmin inserts a new record using service role key (bypasses RLS)
func (s *SupabaseClient) InsertAsAdmin(table string, data interface{}) ([]byte, error) {
	return s.insertWithKey(table, data, s.ServiceKey)
}

// insertWithKey inserts a new record with a specific API key
func (s *SupabaseClient) insertWithKey(table string, data interface{}, apiKey string) ([]byte, error) {
	url := fmt.Sprintf("%s/rest/v1/%s", s.URL, table)

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase error: %s - %s", resp.Status, string(body))
	}

	return body, nil
}

// Update updates a record in a table (uses anon key, RLS applies)
func (s *SupabaseClient) Update(table string, filter map[string]string, data interface{}) ([]byte, error) {
	return s.updateWithKey(table, filter, data, s.AnonKey)
}

// UpdateAsAdmin updates a record using service role key (bypasses RLS)
func (s *SupabaseClient) UpdateAsAdmin(table string, filter map[string]string, data interface{}) ([]byte, error) {
	return s.updateWithKey(table, filter, data, s.ServiceKey)
}

// updateWithKey updates a record with a specific API key
func (s *SupabaseClient) updateWithKey(table string, filter map[string]string, data interface{}, apiKey string) ([]byte, error) {
	url := fmt.Sprintf("%s/rest/v1/%s", s.URL, table)

	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("PATCH", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	// Add filter parameters
	q := req.URL.Query()
	for key, value := range filter {
		q.Add(key, fmt.Sprintf("eq.%s", value))
	}
	req.URL.RawQuery = q.Encode()

	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase error: %s - %s", resp.Status, string(body))
	}

	return body, nil
}

// Delete deletes a record from a table (uses anon key, RLS applies)
func (s *SupabaseClient) Delete(table string, filter map[string]string) error {
	return s.deleteWithKey(table, filter, s.AnonKey)
}

// DeleteAsAdmin deletes a record using service role key (bypasses RLS)
func (s *SupabaseClient) DeleteAsAdmin(table string, filter map[string]string) error {
	return s.deleteWithKey(table, filter, s.ServiceKey)
}

// deleteWithKey deletes a record with a specific API key
func (s *SupabaseClient) deleteWithKey(table string, filter map[string]string, apiKey string) error {
	url := fmt.Sprintf("%s/rest/v1/%s", s.URL, table)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	// Add filter parameters
	q := req.URL.Query()
	for key, value := range filter {
		q.Add(key, fmt.Sprintf("eq.%s", value))
	}
	req.URL.RawQuery = q.Encode()

	req.Header.Set("apikey", apiKey)
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error: %s - %s", resp.Status, string(body))
	}

	return nil
}

// TestConnection tests the connection to Supabase
func (s *SupabaseClient) TestConnection() error {
	// Try to query the user table (should exist after schema execution)
	_, err := s.Query("user", map[string]string{
		"select": "id",
		"limit":  "1",
	})
	return err
}
