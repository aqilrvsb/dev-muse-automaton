// Billings JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Load user info
    loadUserInfo();

    // Load orders
    loadOrders();
});

// Load user info
async function loadUserInfo() {
    const token = localStorage.getItem('auth_token');
    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (data.user && data.user.email) {
            document.getElementById('userEmail').textContent = data.user.email;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Buy package function - Opens payment in NEW TAB
async function buyPackage() {
    const token = localStorage.getItem('auth_token');

    if (!token) {
        Swal.fire({
            title: 'Authentication Required',
            text: 'Please log in to make a purchase',
            icon: 'warning',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    // Show loading
    Swal.fire({
        title: 'Processing...',
        text: 'Creating your order',
        icon: 'info',
        background: '#141414',
        color: '#ffffff',
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const response = await fetch(`${API_BASE_URL}/billing/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product: 'Test Package - RM 1.00',
                method: 'billplz'
            })
        });

        const result = await response.json();

        // Log full response for debugging
        console.log('Order creation response:', result);

        if (!response.ok) {
            throw new Error(result.message || result.error || `Server error: ${response.status}`);
        }

        if (result.success && result.url) {
            // Close loading dialog
            Swal.close();

            // Open payment page in NEW TAB
            window.open(result.url, '_blank');

            // Show success message
            Swal.fire({
                title: 'Order Created!',
                text: 'Payment page opened in new tab. Please complete your payment.',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            }).then(() => {
                // Reload orders after closing dialog
                loadOrders();
            });
        } else {
            throw new Error(result.message || result.error || 'Failed to create order');
        }
    } catch (error) {
        console.error('Error creating order:', error);
        console.error('Full error details:', error);

        Swal.fire({
            title: 'Error Creating Order',
            text: error.message || 'Failed to create order. Please try again.',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914',
            footer: '<span style="font-size: 0.85rem; color: #999;">Check console for more details</span>'
        });
    }
}

// Load orders
async function loadOrders() {
    const token = localStorage.getItem('auth_token');

    if (!token) {
        window.location.href = '/';
        return;
    }

    // Show loading
    document.getElementById('ordersLoading').style.display = 'flex';
    document.getElementById('ordersError').style.display = 'none';
    document.getElementById('ordersEmpty').style.display = 'none';
    document.getElementById('ordersTableContainer').style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/billing/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        // Hide loading
        document.getElementById('ordersLoading').style.display = 'none';

        if (result.success && result.data) {
            const orders = result.data;

            if (orders.length === 0) {
                // Show empty state
                document.getElementById('ordersEmpty').style.display = 'flex';
            } else {
                // Show orders table
                document.getElementById('ordersTableContainer').style.display = 'block';
                renderOrdersTable(orders);
            }
        } else {
            throw new Error(result.message || 'Failed to load orders');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersLoading').style.display = 'none';
        document.getElementById('ordersError').style.display = 'flex';
        document.getElementById('ordersErrorMessage').textContent = error.message || 'Failed to load orders';
    }
}

// Render orders table (matching device settings style)
function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '';

    orders.forEach(order => {
        // Format date
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('en-MY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Status badge
        const statusClass = getStatusClass(order.status);
        const statusBadge = `<span class="status-badge ${statusClass}">${order.status}</span>`;

        // Payment method badge
        const methodBadge = order.method === 'billplz'
            ? '<span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">💳 Billplz</span>'
            : '<span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">💵 COD</span>';

        // Receipt button
        let receiptButton = '';
        if (order.url) {
            receiptButton = `<button onclick="viewReceipt('${order.url}')" style="
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 0.5rem 1rem;
                border-radius: 6px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
                📄 View
            </button>`;
        } else {
            receiptButton = '<span style="color: var(--netflix-light-gray);">-</span>';
        }

        // Action button
        let actionButton = '';
        if (order.status === 'Pending' && order.url) {
            actionButton = `<button onclick="payNow('${order.url}')" style="
                background: linear-gradient(135deg, #e50914 0%, #b00710 100%);
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                color: white;
                font-weight: 600;
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(229, 9, 20, 0.3);
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(229, 9, 20, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(229, 9, 20, 0.3)'">
                Pay Now
            </button>`;
        } else if (order.status === 'Success') {
            actionButton = '<span style="color: #22c55e; font-weight: 600;">✓ Paid</span>';
        } else if (order.status === 'Failed') {
            actionButton = '<span style="color: #ef4444; font-weight: 600;">✗ Failed</span>';
        } else {
            actionButton = '<span style="color: var(--netflix-light-gray);">Processing...</span>';
        }

        // Create table row
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        row.innerHTML = `
            <td style="padding: 1rem; color: var(--netflix-gold); font-weight: 600;">#${order.id}</td>
            <td style="padding: 1rem; color: var(--netflix-light-gray);">${formattedDate}</td>
            <td style="padding: 1rem; color: white;">${order.product}</td>
            <td style="padding: 1rem; color: var(--netflix-gold); font-weight: 700; font-size: 1.05rem;">RM ${parseFloat(order.amount).toFixed(2)}</td>
            <td style="padding: 1rem;">${methodBadge}</td>
            <td style="padding: 1rem;">${statusBadge}</td>
            <td style="padding: 1rem;">${receiptButton}</td>
            <td style="padding: 1rem;">${actionButton}</td>
        `;

        tbody.appendChild(row);
    });
}

// Get status class for badge
function getStatusClass(status) {
    switch (status) {
        case 'Success':
            return 'status-success';
        case 'Pending':
            return 'status-pending';
        case 'Processing':
            return 'status-processing';
        case 'Failed':
            return 'status-failed';
        default:
            return '';
    }
}

// Pay now function - Opens payment in NEW TAB
function payNow(url) {
    if (url) {
        // Open payment in new tab
        window.open(url, '_blank');

        Swal.fire({
            title: 'Payment Page Opened',
            text: 'Complete your payment in the new tab',
            icon: 'info',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        }).then(() => {
            // Reload orders after closing dialog
            loadOrders();
        });
    }
}

// View receipt function - Opens receipt in NEW TAB
function viewReceipt(url) {
    if (url) {
        // Open receipt in new tab
        window.open(url, '_blank');
    }
}

// Logout function
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    window.location.href = '/';
}
