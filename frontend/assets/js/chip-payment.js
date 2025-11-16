/**
 * CHIP Payment Integration for PeningBot
 * Handles subscription payments via CHIP Payment Gateway
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://bjnjucwpwdzgsnqmpmff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTk1MzksImV4cCI6MjA3NjA3NTUzOX0.vw1rOUqYWFkPNDwTdEgIfsCO9pyvTsFKaXHq3RcRTNU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

/**
 * Initialize payment system
 */
export async function initPaymentSystem() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/index.html';
        return null;
    }

    currentUser = session.user;
    return currentUser;
}

/**
 * Get active subscription packages
 */
export async function getActivePackages() {
    try {
        const { data, error } = await supabase
            .from('packages')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching packages:', error);
        throw error;
    }
}

/**
 * Get user's current subscription
 */
export async function getCurrentSubscription(userId) {
    try {
        const { data, error } = await supabase
            .from('user')
            .select(`
                *,
                packages (*)
            `)
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching subscription:', error);
        throw error;
    }
}

/**
 * Get user's payment history
 */
export async function getPaymentHistory(userId) {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select(`
                *,
                packages (name)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching payment history:', error);
        throw error;
    }
}

/**
 * Initiate CHIP payment for subscription
 */
export async function initiatePayment(packageId, amount, packageName) {
    try {
        console.log('Initiating CHIP payment:', {
            user_id: currentUser.id,
            package_id: packageId,
            amount,
            description: `Subscription - ${packageName}`
        });

        const { data, error } = await supabase.functions.invoke('chip-payment-topup', {
            body: {
                user_id: currentUser.id,
                package_id: packageId,
                amount: amount,
                description: `Subscription - ${packageName}`
            }
        });

        if (error) {
            console.error('Payment initiation error:', error);
            throw error;
        }

        console.log('Payment response:', data);

        if (!data.payment_url) {
            throw new Error('No payment URL received from server');
        }

        return data;
    } catch (error) {
        console.error('Error initiating payment:', error);
        throw error;
    }
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(userId) {
    try {
        const subscription = await getCurrentSubscription(userId);

        if (!subscription || subscription.subscription_status !== 'active') {
            return false;
        }

        const now = new Date();
        const endDate = new Date(subscription.subscription_end);

        return endDate > now;
    } catch (error) {
        console.error('Error checking subscription:', error);
        return false;
    }
}

/**
 * Check if user can add more devices
 */
export async function canAddDevice(userId) {
    try {
        const subscription = await getCurrentSubscription(userId);

        if (!subscription || subscription.subscription_status !== 'active') {
            return {
                allowed: false,
                reason: 'No active subscription'
            };
        }

        const { data: devices, error } = await supabase
            .from('device_setting')
            .select('id')
            .eq('user_id', userId);

        if (error) throw error;

        const deviceCount = devices?.length || 0;
        const maxDevices = subscription.max_devices || 1;

        return {
            allowed: deviceCount < maxDevices,
            current: deviceCount,
            max: maxDevices,
            reason: deviceCount >= maxDevices ? `Device limit reached (${maxDevices})` : null
        };
    } catch (error) {
        console.error('Error checking device limit:', error);
        return {
            allowed: false,
            reason: 'Error checking device limit'
        };
    }
}

/**
 * Format currency (MYR)
 */
export function formatCurrency(amount) {
    return `RM ${parseFloat(amount).toFixed(2)}`;
}

/**
 * Format date
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Get subscription status badge HTML
 */
export function getStatusBadge(status) {
    const badges = {
        active: '<span class="badge badge-success">Active</span>',
        expired: '<span class="badge badge-danger">Expired</span>',
        cancelled: '<span class="badge badge-warning">Cancelled</span>',
        inactive: '<span class="badge badge-secondary">Inactive</span>'
    };

    return badges[status] || badges.inactive;
}

/**
 * Get payment status badge HTML
 */
export function getPaymentStatusBadge(status) {
    const badges = {
        paid: '<span class="badge badge-success">Paid</span>',
        pending: '<span class="badge badge-warning">Pending</span>',
        failed: '<span class="badge badge-danger">Failed</span>',
        refunded: '<span class="badge badge-info">Refunded</span>'
    };

    return badges[status] || badges.pending;
}

// Export for use in HTML pages
window.ChipPayment = {
    initPaymentSystem,
    getActivePackages,
    getCurrentSubscription,
    getPaymentHistory,
    initiatePayment,
    hasActiveSubscription,
    canAddDevice,
    formatCurrency,
    formatDate,
    getStatusBadge,
    getPaymentStatusBadge
};
