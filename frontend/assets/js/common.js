// Common JavaScript functions for all pages
// Declare API_BASE_URL for all pages that include this script
// For production, this will point to Deno Deploy backend
const API_BASE_URL = window.VITE_API_URL || import.meta.env.VITE_API_URL || window.location.origin + '/api';

// Show Packages tab for admin users
async function showPackagesTabForAdmin() {
    // Use Supabase session instead of localStorage
    if (!window.supabase) return;

    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        const data = await response.json();

        if (data.user && (data.user.email === 'Admin@gmail.com' || data.user.role === 'admin')) {
            const packagesTab = document.getElementById('packagesTab');
            if (packagesTab) {
                packagesTab.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

// Call this on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showPackagesTabForAdmin);
} else {
    showPackagesTabForAdmin();
}
