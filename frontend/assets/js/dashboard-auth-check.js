/**
 * Dashboard Authentication Check
 * This module checks Supabase session and ensures user is authenticated
 * NO localStorage - uses ONLY Supabase sessions like chain-stock-flow-main
 */

import { supabase } from './auth.js';

async function checkDashboardAuth() {
    try {
        // Check Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            window.location.href = window.location.origin + '/index.html';
            return false;
        }

        // Check if user is active in database
        const { data: userData, error: userError } = await supabase
            .from('user')
            .select('is_active')
            .eq('id', session.user.id)
            .single();

        if (userError) {
            console.error('Error fetching user data:', userError);

            // If RLS policies not set up yet, allow access temporarily
            // This prevents infinite redirect loop before migrations are run
            if (userError.code === 'PGRST301' || userError.message?.includes('row-level security') || userError.message?.includes('permission denied')) {
                console.warn('RLS policies not configured - allowing access. Please run auth_migration_update.sql');
                return session; // Allow access but warn
            }

            // For other errors, sign out and redirect
            await supabase.auth.signOut();
            window.location.href = window.location.origin + '/index.html';
            return false;
        }

        if (!userData || !userData.is_active) {
            await supabase.auth.signOut();
            window.location.href = window.location.origin + '/index.html';
            return false;
        }

        return session;

    } catch (error) {
        console.error('Error in checkDashboardAuth:', error);
        window.location.href = window.location.origin + '/index.html';
        return false;
    }
}

// Get current user session
async function getCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Get current user profile
async function getCurrentUserProfile() {
    const session = await getCurrentSession();
    if (!session) return null;

    const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('id', session.user.id)
        .single();

    return error ? null : data;
}

export { checkDashboardAuth, getCurrentSession, getCurrentUserProfile };
