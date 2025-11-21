// Set Stage JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Load devices for dropdown
async function loadDevices() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/devices`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        const deviceSelect = document.getElementById('deviceSelect');
        deviceSelect.innerHTML = '<option value="">Select a device...</option>';

        if (data.success && data.devices && data.devices.length > 0) {
            data.devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id_device || device.device_id;
                option.textContent = `${device.id_device || device.device_id} - ${device.provider}`;
                deviceSelect.appendChild(option);
            });
        }

        // If in edit mode, populate the form with stored stage data
        if (window.editingStageData) {
            const stage = window.editingStageData;
            const deviceSelect = document.getElementById('deviceSelect');

            deviceSelect.value = stage.id_device || '';
            document.getElementById('stageInput').value = stage.stage || '';
            document.getElementById('typeSelect').value = stage.type_inputdata || stage.type || '';
            document.getElementById('inputHardCode').value = stage.inputhardcode || stage.input_hard_code || '';
            document.getElementById('columnSelect').value = stage.columnsdata || stage.column || '';

            // Disable device select in edit mode (device cannot be changed)
            deviceSelect.disabled = true;
            deviceSelect.style.cursor = 'not-allowed';
            deviceSelect.style.opacity = '0.6';

            // Toggle Input Hard Code field visibility
            toggleInputHardCode();

            // Clear the temporary data
            window.editingStageData = null;
        }
    } catch (error) {
        console.error('Load devices error:', error);
    }
}

// Load stage values
async function loadStageValues() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/stage-values`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        const stageValuesList = document.getElementById('stageValuesList');

        if (data.success && data.stage_values && data.stage_values.length > 0) {
            stageValuesList.innerHTML = `
                <table class="stage-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Device ID</th>
                            <th>Stage</th>
                            <th>Type</th>
                            <th>Input Hard Code</th>
                            <th>Column</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.stage_values.map(stage => `
                            <tr>
                                <td><strong>${stage.stagesetvalue_id || stage.id}</strong></td>
                                <td>${stage.id_device || '-'}</td>
                                <td><strong>${stage.stage || '-'}</strong></td>
                                <td><span class="type-badge type-${(stage.type_inputdata || stage.type || '').toLowerCase()}">${stage.type_inputdata || stage.type || '-'}</span></td>
                                <td>${stage.inputhardcode || stage.input_hard_code || '-'}</td>
                                <td><span class="column-badge">${stage.columnsdata || stage.column || '-'}</span></td>
                                <td>
                                    <div class="btn-action-group">
                                        <button class="btn-edit" onclick='editStageValue(${JSON.stringify(stage)})'>Edit</button>
                                        <button class="btn-delete" onclick="deleteStageValue(${stage.stagesetvalue_id || stage.id})">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            stageValuesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚙️</div>
                    <h2 class="empty-state-title">No Stage Values Yet</h2>
                    <p class="empty-state-text">Click "Add Set Stage" to create your first stage value</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load stage values error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Failed to load stage values',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Toggle Input Hard Code field visibility based on Type selection
function toggleInputHardCode() {
    const typeSelect = document.getElementById('typeSelect');
    const inputHardCodeGroup = document.getElementById('inputHardCodeGroup');
    const inputHardCode = document.getElementById('inputHardCode');

    if (typeSelect.value === 'Set') {
        inputHardCodeGroup.classList.remove('hidden');
        inputHardCode.setAttribute('required', 'required');
    } else {
        inputHardCodeGroup.classList.add('hidden');
        inputHardCode.removeAttribute('required');
        inputHardCode.value = ''; // Clear the value when hidden
    }
}

// Open stage modal
function openStageModal() {
    const modal = document.getElementById('stageModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadDevices();
}

// Close stage modal
function closeStageModal() {
    const modal = document.getElementById('stageModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';

    // Reset form
    document.getElementById('stageForm').reset();
    document.querySelector('.modal-title').textContent = 'Add Stage Value';
    window.editingStageId = null;
    window.editingStageData = null;

    // Re-enable device select
    const deviceSelect = document.getElementById('deviceSelect');
    deviceSelect.disabled = false;
    deviceSelect.style.cursor = '';
    deviceSelect.style.opacity = '';

    // Hide Input Hard Code field by default
    document.getElementById('inputHardCodeGroup').classList.add('hidden');
}

// Save stage value
async function saveStageValue(event) {
    event.preventDefault();

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    const isEditMode = window.editingStageId !== undefined && window.editingStageId !== null;

    const typeValue = document.getElementById('typeSelect').value;
    const stageData = {
        id_device: document.getElementById('deviceSelect').value,
        stage: document.getElementById('stageInput').value.trim(),
        type_inputdata: typeValue,
        columnsdata: document.getElementById('columnSelect').value
    };

    // Only include inputhardcode if Type is "Set"
    if (typeValue === 'Set') {
        stageData.inputhardcode = document.getElementById('inputHardCode').value.trim();
    } else {
        stageData.inputhardcode = ''; // Empty string for Input type
    }

    // Show loading
    Swal.fire({
        title: isEditMode ? 'Updating...' : 'Saving...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
        background: '#141414',
        color: '#ffffff'
    });

    try {
        const url = isEditMode
            ? `${API_BASE_URL}/stage-values/${window.editingStageId}`
            : `${API_BASE_URL}/stage-values`;

        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(stageData)
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Success!',
                text: isEditMode ? 'Stage value updated successfully' : 'Stage value created successfully',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });

            closeStageModal();
            loadStageValues();
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'Failed to save stage value',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Save stage value error:', error);
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

// Edit stage value
async function editStageValue(stage) {
    // Change modal title
    document.querySelector('.modal-title').textContent = 'Edit Stage Value';

    // Store stage ID for update
    window.editingStageId = stage.stagesetvalue_id || stage.id;

    // Store stage data temporarily
    window.editingStageData = stage;

    // Open modal (this will load devices)
    openStageModal();
}

// Delete stage value
async function deleteStageValue(stageId) {
    const result = await Swal.fire({
        title: 'Delete Stage Value?',
        text: 'This action cannot be undone!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e50914',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        background: '#141414',
        color: '#ffffff'
    });

    if (!result.isConfirmed) return;

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/stage-values/${stageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Deleted!',
                text: 'Stage value has been deleted',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });

            loadStageValues();
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'Failed to delete stage value',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Delete stage value error:', error);
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
    loadStageValues();
});
