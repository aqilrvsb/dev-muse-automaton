// Packages JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Store for editing
let editingPackageId = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Load user profile
    await loadUserProfile();

    // Load packages
    await loadPackages();
});

// Load user profile
async function loadUserProfile() {
    const token = localStorage.getItem('auth_token');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('userEmail').textContent = data.user.email;

            // Check if user is admin
            if (data.user.email !== 'Admin@gmail.com' && data.user.role !== 'admin') {
                // Not admin, redirect to dashboard
                Swal.fire({
                    title: 'Access Denied!',
                    text: 'Only administrators can access the Packages page',
                    icon: 'error',
                    background: '#141414',
                    color: '#ffffff',
                    confirmButtonColor: '#e50914'
                }).then(() => {
                    window.location.href = '/dashboard.html';
                });
            }
        } else {
            localStorage.removeItem('auth_token');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Profile load error:', error);
        localStorage.removeItem('auth_token');
        window.location.href = '/';
    }
}

// Load all packages
async function loadPackages() {
    const token = localStorage.getItem('auth_token');

    try {
        const response = await fetch(`${API_BASE_URL}/packages`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success && data.packages && data.packages.length > 0) {
            displayPackages(data.packages);
        } else {
            document.getElementById('packagesList').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <h2 class="empty-state-title">No Packages Yet</h2>
                    <p class="empty-state-text">Click "New Package" to add your first billing package</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load packages error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Failed to load packages',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Display packages in a table
function displayPackages(packages) {
    const packagesList = document.getElementById('packagesList');

    packagesList.innerHTML = `
        <div class="table-container">
            <table class="devices-table">
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Package Name</th>
                        <th>Amount</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${packages.map((pkg, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td><strong>${pkg.name}</strong></td>
                            <td>RM ${pkg.amount}</td>
                            <td>${new Date(pkg.created_at).toLocaleDateString('en-MY')}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn-action btn-edit" onclick="editPackage(${pkg.id}, '${pkg.name}', '${pkg.amount}')" title="Edit">
                                        ✏️
                                    </button>
                                    <button class="btn-action btn-delete" onclick="deletePackage(${pkg.id}, '${pkg.name}')" title="Delete">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Open package modal (for create)
function openPackageModal() {
    editingPackageId = null;
    document.getElementById('modalTitle').textContent = 'Add New Package';
    document.getElementById('packageForm').reset();
    document.getElementById('packageModal').classList.add('active');
}

// Close package modal
function closePackageModal() {
    editingPackageId = null;
    document.getElementById('packageModal').classList.remove('active');
    document.getElementById('packageForm').reset();
}

// Edit package
function editPackage(id, name, amount) {
    editingPackageId = id;
    document.getElementById('modalTitle').textContent = 'Edit Package';
    document.getElementById('packageName').value = name;
    document.getElementById('packageAmount').value = amount;
    document.getElementById('packageModal').classList.add('active');
}

// Save package (create or update)
async function savePackage(event) {
    event.preventDefault();

    const token = localStorage.getItem('auth_token');
    const name = document.getElementById('packageName').value.trim();
    const amount = document.getElementById('packageAmount').value.trim();

    if (!name || !amount) {
        Swal.fire({
            title: 'Error!',
            text: 'Please fill in all fields',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    try {
        const url = editingPackageId
            ? `${API_BASE_URL}/packages/${editingPackageId}`
            : `${API_BASE_URL}/packages`;

        const method = editingPackageId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, amount })
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Success!',
                text: editingPackageId ? 'Package updated successfully' : 'Package created successfully',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#00b300'
            });

            closePackageModal();
            await loadPackages();
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'Failed to save package',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Save package error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Failed to save package',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Delete package
async function deletePackage(id, name) {
    const result = await Swal.fire({
        title: 'Delete Package?',
        text: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        background: '#141414',
        color: '#ffffff',
        confirmButtonColor: '#e50914',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
        return;
    }

    const token = localStorage.getItem('auth_token');

    try {
        const response = await fetch(`${API_BASE_URL}/packages/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Deleted!',
                text: 'Package has been deleted',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#00b300'
            });

            await loadPackages();
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'Failed to delete package',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Delete package error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Failed to delete package',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Logout
function logout() {
    localStorage.removeItem('auth_token');
    window.location.href = '/';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('packageModal');
    if (event.target === modal) {
        closePackageModal();
    }
};
