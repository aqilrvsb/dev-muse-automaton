// API Base URL - adjust if needed
const API_BASE_URL = window.location.origin + '/api';

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
    const messages = document.querySelectorAll('.error-message, .success-message');
    messages.forEach(msg => msg.remove());
}

// Show error message
function showError(formId, message) {
    clearMessages();
    const form = document.getElementById(formId);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    form.insertBefore(errorDiv, form.firstChild);
}

// Show success message
function showSuccess(formId, message) {
    clearMessages();
    const form = document.getElementById(formId);
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    form.insertBefore(successDiv, form.firstChild);
}

// Set button loading state
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('btn-loader');
        button.dataset.originalText = button.textContent;
        button.textContent = 'Loading...';
    } else {
        button.disabled = false;
        button.classList.remove('btn-loader');
        button.textContent = button.dataset.originalText || button.textContent;
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
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (data.success && data.token) {
            // Store token in localStorage
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('user_email', email);

            // Show success message
            showSuccess('loginForm', 'Login successful! Redirecting...');

            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showError('loginForm', data.message || 'Login failed. Please try again.');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('loginForm', 'Network error. Please check your connection and try again.');
    } finally {
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
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                full_name: name,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (data.success && data.token) {
            // Store token in localStorage
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('user_email', email);

            // Show success message
            showSuccess('registerForm', 'Registration successful! Redirecting...');

            // Redirect to dashboard after 1 second
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showError('registerForm', data.message || 'Registration failed. Please try again.');
        }
    } catch (error) {
        console.error('Register error:', error);
        showError('registerForm', 'Network error. Please check your connection and try again.');
    } finally {
        setButtonLoading(submitButton, false);
    }
}

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('auth_token');
    if (token) {
        // User is already logged in, redirect to dashboard
        window.location.href = '/dashboard.html';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();

    // Add enter key listener for better UX
    document.getElementById('loginEmail')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('loginPassword')?.focus();
        }
    });

    document.getElementById('registerEmail')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('registerPassword')?.focus();
        }
    });
});
