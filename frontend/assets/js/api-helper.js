/**
 * API Helper - Provides utility functions for API calls with Supabase authentication
 */

import { supabase } from './auth.js';

/**
 * Get the current Supabase session access token
 * @returns {Promise<string|null>} The access token or null if no session
 */
export async function getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

/**
 * Make an authenticated API call
 * @param {string} url - The API endpoint URL
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} The fetch response
 */
export async function authenticatedFetch(url, options = {}) {
    const token = await getAuthToken();

    if (!token) {
        // No session - redirect to login
        window.location.href = '/index.html';
        throw new Error('No authentication token');
    }

    // Merge auth header with any existing headers
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    return fetch(url, {
        ...options,
        headers
    });
}

/**
 * Check if user is authenticated (has a valid session)
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
}
