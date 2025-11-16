/**
 * Authentication using Supabase Auth
 * Based on chain-stock-flow-main reference implementation
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://bjnjucwpwdzgsnqmpmff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTk1MzksImV4cCI6MjA3NjA3NTUzOX0.vw1rOUqYWFkPNDwTdEgIfsCO9pyvTsFKaXHq3RcRTNU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Show/Hide Forms
function showRegister(event) {
    if (event) event.preventDefault();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    clearMessages();
}

function showLogin(event) {
    if (event) event.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    clearMessages();
}

// Clear all messages
function clearMessages() {
    const errorEl = document.getElementById('loginError');
    const registerErrorEl = document.getElementById('registerError');
    const registerSuccessEl = document.getElementById('registerSuccess');

    if (errorEl) errorEl.style.display = 'none';
    if (registerErrorEl) registerErrorEl.style.display = 'none';
    if (registerSuccessEl) registerSuccessEl.style.display = 'none';
}

// Show error message
function showError(formId, message) {
    clearMessages();
    const errorEl = formId === 'loginForm'
        ? document.getElementById('loginError')
        : document.getElementById('registerError');

    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

// Show success message
function showSuccess(formId, message) {
    clearMessages();
    const successEl = document.getElementById('registerSuccess');
    if (successEl) {
        successEl.textContent = message;
        successEl.style.display = 'block';
    }
}

// Set button loading state
function setButtonLoading(button, isLoading) {
    const spinner = button.querySelector('.btn-loader');
    const text = button.querySelector('span:not(.btn-loader)');

    if (isLoading) {
        button.disabled = true;
        if (spinner) spinner.style.display = 'inline-block';
        if (text) text.style.display = 'none';
    } else {
        button.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (text) text.style.display = 'inline-block';
    }
}

// Check if user is active
async function checkUserActiveStatus(userId) {
    try {
        const { data, error } = await supabase
            .from('user')
            .select('is_active')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error checking user active status:', error);
            // If RLS policies not set up yet, assume user is active
            // This prevents infinite reload loop before migrations are run
            if (error.code === 'PGRST301' || error.message?.includes('row-level security')) {
                console.warn('RLS policies not set up yet - assuming user is active. Please run auth_migration.sql');
                return true;
            }
            return false;
        }

        if (!data) {
            console.error('No user data found');
            return false;
        }

        return data.is_active === true;
    } catch (error) {
        console.error('Error checking user active status:', error);
        // On network/fetch errors, assume active to prevent infinite reload
        return true;
    }
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const submitButton = event.target.querySelector('button[type="submit"]');

    // Basic validation
    if (!email || !password) {
        showError('loginForm', 'Please fill in all fields');
        return;
    }

    setButtonLoading(submitButton, true);

    try {
        let loginEmail = email;

        // If input is not an email (no @), look up email from user table
        if (!email.includes('@')) {
            console.log('Looking up email for identifier:', email);
            const { data, error: lookupError } = await supabase.functions.invoke('get-email-from-user', {
                body: { identifier: email },
            });

            if (lookupError || !data?.email) {
                showError('loginForm', 'Invalid email or password');
                setButtonLoading(submitButton, false);
                return;
            }

            loginEmail = data.email;
            console.log('Found email for identifier');
        }

        // Sign in with Supabase Auth
        const { data: authData, error } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password,
        });

        if (error) {
            console.error('Login error:', error);
            showError('loginForm', error.message || 'Login failed. Please check your credentials.');
            setButtonLoading(submitButton, false);
            return;
        }

        // Check if user is active
        if (authData?.user) {
            const isActive = await checkUserActiveStatus(authData.user.id);

            if (!isActive) {
                // User is inactive, sign them out immediately
                await supabase.auth.signOut();
                showError('loginForm', 'Your account has been deactivated. Please contact an administrator.');
                setButtonLoading(submitButton, false);
                return;
            }
        }

        // Success - redirect to dashboard (Supabase handles session)
        console.log('Login successful');
        window.location.href = '/dashboard.html';

    } catch (error) {
        console.error('Login error:', error);
        showError('loginForm', 'Network error. Please check your connection and try again.');
        setButtonLoading(submitButton, false);
    }
}

// Handle Register
async function handleRegister(event) {
    event.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const submitButton = event.target.querySelector('button[type="submit"]');

    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
        showError('registerForm', 'Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        showError('registerForm', 'Passwords do not match');
        return;
    }

    if (password.length < 8) {
        showError('registerForm', 'Password must be at least 8 characters long');
        return;
    }

    setButtonLoading(submitButton, true);

    try {
        // Sign up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/dashboard.html`,
                data: {
                    full_name: name,
                },
            },
        });

        if (error) {
            console.error('Registration error:', error);
            showError('registerForm', error.message || 'Registration failed. Please try again.');
            setButtonLoading(submitButton, false);
            return;
        }

        // Check if email confirmation is required
        if (data.user && !data.session) {
            showSuccess('registerForm', 'Registration successful! Please check your email to confirm your account.');
        } else {
            showSuccess('registerForm', 'Registration successful! Redirecting...');
            // Redirect to dashboard after 1 second (Supabase handles session)
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        }

    } catch (error) {
        console.error('Register error:', error);
        showError('registerForm', 'Network error. Please check your connection and try again.');
    } finally {
        setButtonLoading(submitButton, false);
    }
}

// Check if user is already logged in
async function checkAuthStatus() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // User is already logged in, redirect to dashboard
        window.location.href = '/dashboard.html';
    }
}

// Handle Logout
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/index.html';
}

// Make functions globally available IMMEDIATELY (before DOMContentLoaded)
// This ensures inline onclick handlers can find them
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.handleLogout = handleLogout;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
});

// Export for use in other files
export { supabase, handleLogout, checkUserActiveStatus };
