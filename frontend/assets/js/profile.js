// Profile JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Load user profile data
async function loadProfile() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success && data.user) {
            const user = data.user;

            // Profile Information
            document.getElementById('fullName').textContent = user.full_name || '-';
            document.getElementById('email').textContent = user.email || '-';
            document.getElementById('gmailInput').value = user.gmail || '';
            document.getElementById('phoneInput').value = user.phone || '';

            // Account Status
            const statusBadge = document.getElementById('status');
            statusBadge.textContent = user.status || 'Trial';
            statusBadge.className = 'status-badge';

            document.getElementById('expired').textContent = user.expired || '-';
            document.getElementById('createdAt').textContent = user.created_at
                ? new Date(user.created_at).toLocaleString()
                : '-';
            document.getElementById('lastLogin').textContent = user.last_login
                ? new Date(user.last_login).toLocaleString()
                : '-';
            document.getElementById('accountId').textContent = user.id || '-';
        } else {
            Swal.fire({
                title: 'Error!',
                text: 'Failed to load profile data',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Profile load error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Network error. Please check your connection.',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Change password
async function changePassword(event) {
    event.preventDefault();

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        Swal.fire({
            title: 'Error!',
            text: 'New passwords do not match',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    // Validate password length
    if (newPassword.length < 6) {
        Swal.fire({
            title: 'Error!',
            text: 'Password must be at least 6 characters long',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    // Show loading
    Swal.fire({
        title: 'Changing Password...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
        background: '#141414',
        color: '#ffffff'
    });

    try {
        const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Success!',
                text: 'Password changed successfully',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });

            // Reset form
            document.getElementById('passwordForm').reset();
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'Failed to change password',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Change password error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Network error. Please check your connection.',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Save profile (Gmail and Phone)
async function saveProfile() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    const gmail = document.getElementById('gmailInput').value.trim();
    const phone = document.getElementById('phoneInput').value.trim();

    // Show loading
    Swal.fire({
        title: 'Saving Profile...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
        background: '#141414',
        color: '#ffffff'
    });

    try {
        const response = await fetch(`${API_BASE_URL}/auth/update-profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                gmail: gmail || null,
                phone: phone || null
            })
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Success!',
                text: 'Profile updated successfully',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'Failed to update profile',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Save profile error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Network error. Please check your connection.',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Load user info for sidebar
async function loadUserInfo() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem('auth_token');
            window.location.href = '/';
            return;
        }

        const data = await response.json();
        if (data.user && data.user.email) {
            document.getElementById('userEmail').textContent = data.user.email;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        localStorage.removeItem('auth_token');
        window.location.href = '/';
    }
}

// Logout function
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    window.location.href = '/';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    loadUserInfo();
    loadProfile();
});
