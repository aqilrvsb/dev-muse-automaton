// Device Settings JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Generate device via API (Whacenter or Waha)
async function generateDeviceId() {
    // Check if we're editing a device
    if (!window.editingDeviceId) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Please save the device first before generating',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Show loading
    Swal.fire({
        title: 'Generating Device...',
        html: 'Please wait while we connect to the provider API',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
        background: '#141414',
        color: '#ffffff'
    });

    try {
        const response = await fetch(`${API_BASE_URL}/devices/${window.editingDeviceId}/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: data.message || 'Device generated successfully',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            }).then(() => {
                // Reload devices to show updated data
                loadDevices();
                closeDeviceModal();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Generation Failed',
                text: data.message || 'Failed to generate device',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Generate device error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Network error. Please try again.',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Generate webhook URL
function generateWebhook() {
    const randomPath = Math.random().toString(36).substring(2, 15);
    const randomToken = Math.random().toString(36).substring(2, 15);
    const webhookUrl = `${API_BASE_URL}/webhook/whatsapp/${randomPath}/${randomToken}`;
    document.getElementById('webhookId').value = webhookUrl;
}

// Open device modal
function openDeviceModal() {
    const modal = document.getElementById('deviceModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close device modal
function closeDeviceModal() {
    const modal = document.getElementById('deviceModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';

    // Reset form
    document.getElementById('deviceForm').reset();
    document.getElementById('deviceId').value = '';
    document.getElementById('webhookId').value = '';

    // Reset modal title and editing state
    document.querySelector('.modal-title').textContent = 'Add New Device';
    window.editingDeviceId = null;
}

// Save device
async function saveDevice(event) {
    event.preventDefault();

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Check if we're editing
    const isEditMode = window.editingDeviceId !== undefined && window.editingDeviceId !== null;

    // Get form values
    let deviceId = document.getElementById('deviceId').value.trim();
    let webhookId = document.getElementById('webhookId').value.trim();
    const apiKeyOption = document.querySelector('input[name="apiKeyOption"]:checked').value;
    const provider = document.querySelector('input[name="provider"]:checked').value;
    const apiKey = document.getElementById('apiKey').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    const idDevice = document.getElementById('idDevice').value.trim();
    const idErp = document.getElementById('idErp').value.trim();
    const idAdmin = document.getElementById('idAdmin').value.trim();

    // For non-wablas providers, device_id should be empty/null (only for CREATE mode)
    if (!isEditMode && provider !== 'wablas') {
        deviceId = '';
    }

    // Auto-generate Device ID if not provided and provider is wablas (only for CREATE mode)
    if (!isEditMode && provider === 'wablas' && !deviceId) {
        deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15).toUpperCase();
        document.getElementById('deviceId').value = deviceId;
    }

    // Auto-generate Webhook if not provided (only for CREATE mode)
    if (!isEditMode && !webhookId) {
        const randomPath = Math.random().toString(36).substring(2, 15);
        const randomToken = Math.random().toString(36).substring(2, 15);
        webhookId = `${API_BASE_URL}/webhook/whatsapp/${randomPath}/${randomToken}`;
        document.getElementById('webhookId').value = webhookId;
    }

    // Validate required fields
    if (!idDevice) {
        Swal.fire({
            title: 'Error!',
            text: 'ID Device is required',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    // Validate phone number (only numbers)
    if (phoneNumber && !/^\d+$/.test(phoneNumber)) {
        Swal.fire({
            title: 'Error!',
            text: 'Phone number must contain only numbers',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    // Show loading
    Swal.fire({
        title: 'Saving...',
        text: 'Please wait while we save your device',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        },
        background: '#141414',
        color: '#ffffff'
    });

    try {
        let response;

        if (isEditMode) {
            // Update existing device
            response = await fetch(`${API_BASE_URL}/devices/${window.editingDeviceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    webhook_url: webhookId,
                    api_key_option: apiKeyOption,
                    provider: provider,
                    api_key: apiKey,
                    phone_number: phoneNumber,
                    id_device: idDevice,
                    id_erp: idErp,
                    id_admin: idAdmin
                })
            });
        } else {
            // Create new device
            // For wablas, device_id is required; for others, send empty string
            const requestBody = {
                webhook_url: webhookId,
                api_key_option: apiKeyOption,
                provider: provider,
                api_key: apiKey,
                phone_number: phoneNumber,
                id_device: idDevice,
                id_erp: idErp,
                id_admin: idAdmin
            };

            // Only include device_id if provider is wablas
            if (provider === 'wablas') {
                requestBody.device_id = deviceId || 'DEV-' + Math.random().toString(36).substring(2, 15).toUpperCase();
            } else {
                requestBody.device_id = '';
            }

            response = await fetch(`${API_BASE_URL}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });
        }

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Success!',
                text: isEditMode ? 'Device has been updated successfully' : 'Device has been saved successfully',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });

            // Clear editing state
            window.editingDeviceId = null;

            closeDeviceModal();
            loadDevices(); // Reload devices list
        } else {
            // Check if it's a duplicate ID error
            if (data.message && data.message.includes('already exists')) {
                Swal.fire({
                    title: 'Duplicate Device!',
                    text: 'A device with this ID already exists. Please use a different ID Device.',
                    icon: 'warning',
                    background: '#141414',
                    color: '#ffffff',
                    confirmButtonColor: '#e50914'
                });
            } else {
                Swal.fire({
                    title: 'Error!',
                    text: data.message || 'Failed to save device',
                    icon: 'error',
                    background: '#141414',
                    color: '#ffffff',
                    confirmButtonColor: '#e50914'
                });
            }
        }
    } catch (error) {
        console.error('Save device error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Network error. Please check your connection and try again.',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Load devices list
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

        const devicesList = document.getElementById('devicesList');

        if (data.success && data.devices && data.devices.length > 0) {
            devicesList.innerHTML = `
                <div class="table-container">
                    <table class="devices-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>ID Device</th>
                                <th>Phone Number</th>
                                <th>Instance</th>
                                <th>Webhook ID</th>
                                <th>Provider</th>
                                <th>API Key Option</th>
                                <th>API Key</th>
                                <th>ID ERP</th>
                                <th>ID Admin</th>
                                <th>Status</th>
                                <th>Created At</th>
                                <th>Updated At</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.devices.map((device, index) => `
                                <tr>
                                    <td><strong>${device.device_id || '-'}</strong></td>
                                    <td>${device.id_device || '-'}</td>
                                    <td>${device.phone_number || '-'}</td>
                                    <td>${device.instance || '-'}</td>
                                    <td class="webhook-cell">${device.webhook_id || '-'}</td>
                                    <td><span class="badge badge-${device.provider}">${device.provider || '-'}</span></td>
                                    <td>${device.api_key_option || '-'}</td>
                                    <td>${device.api_key ? '••••••' : '-'}</td>
                                    <td>${device.id_erp || '-'}</td>
                                    <td>${device.id_admin || '-'}</td>
                                    <td><button class="btn-status" onclick="showStatus('${device.id}', '${device.id_device}', '${device.phone_number}', '${device.provider}')">Check</button></td>
                                    <td>${device.created_at ? new Date(device.created_at).toLocaleString() : '-'}</td>
                                    <td>${device.updated_at ? new Date(device.updated_at).toLocaleString() : '-'}</td>
                                    <td><button class="btn-action" onclick='editDevice(${JSON.stringify(device)})'>Edit</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            devicesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📱</div>
                    <h2 class="empty-state-title">No Devices Yet</h2>
                    <p class="empty-state-text">Click "New Device" to add your first WhatsApp device</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load devices error:', error);
    }
}

// Only allow numbers in phone number field
function restrictToNumbers(event) {
    const input = event.target;
    input.value = input.value.replace(/[^0-9]/g, '');
}

// Show device status modal
async function showStatus(deviceId, idDevice, phoneNumber, provider) {
    // Check token first before showing loading state
    const token = localStorage.getItem('auth_token');
    if (!token) {
        Swal.fire({
            icon: 'error',
            title: 'Authentication Error',
            text: 'Please login again',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    // Show loading state
    Swal.fire({
        title: 'Checking Device Status',
        html: '<div class="loading-spinner">🔄 Please wait...</div>',
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#141414',
        color: '#ffffff',
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {

        const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!result.success) {
            Swal.fire({
                icon: 'error',
                title: 'Status Check Failed',
                text: result.message || 'Failed to check device status'
            });
            return;
        }

        // Determine connection status badge
        let isConnected = false;
        let statusBadge = 'status-disconnected';
        let statusText = 'NOT CONNECTED';

        if (result.provider === 'whacenter') {
            isConnected = result.status === 'CONNECTED';
            statusText = result.status;
            statusBadge = isConnected ? 'status-connected' : 'status-disconnected';
        } else if (result.provider === 'waha') {
            isConnected = result.status === 'WORKING';
            statusText = result.status;
            statusBadge = isConnected ? 'status-connected' : 'status-disconnected';
        }

        // Build HTML content
        let htmlContent = `
            <div class="status-body">
                <div class="status-item">
                    <span class="status-label">Status:</span>
                    <span class="status-badge ${statusBadge}">${statusText}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Provider:</span>
                    <span class="status-value">${result.provider.toUpperCase()}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Connected:</span>
                    <span class="status-badge ${isConnected ? 'status-connected' : 'status-disconnected'}">${isConnected ? 'Yes' : 'No'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Checked:</span>
                    <span class="status-value">${new Date().toLocaleString()}</span>
                </div>
                <div class="device-info-box">
                    <div class="device-info-title">📱 Device Info</div>
                    <div class="device-info-item"><strong>Name:</strong> ${idDevice}</div>
                    <div class="device-info-item"><strong>Number:</strong> ${phoneNumber}</div>
                </div>
        `;

        // Add QR code if available
        if (result.image) {
            htmlContent += `
                <div class="qr-code-container" style="margin-top: 20px; text-align: center;">
                    <div style="color: #ffd700; font-weight: bold; margin-bottom: 10px;">
                        📱 Scan QR Code to Connect
                    </div>
                    <img src="${result.image}" alt="QR Code" style="max-width: 300px; width: 100%; border: 3px solid #ffd700; border-radius: 10px; padding: 10px; background: white;">
                </div>
            `;
        }

        htmlContent += '</div>';

        // Show result modal
        Swal.fire({
            title: 'Device Status',
            html: htmlContent,
            showCloseButton: true,
            showConfirmButton: true,
            confirmButtonText: 'Refresh Status',
            confirmButtonColor: '#e50914',
            background: '#141414',
            color: '#ffffff',
            customClass: {
                popup: 'status-modal-content',
                title: 'status-title',
                confirmButton: 'btn-primary'
            }
        }).then((result) => {
            // If user clicks refresh, call showStatus again
            if (result.isConfirmed) {
                showStatus(deviceId, idDevice, phoneNumber, provider);
            }
        });

    } catch (error) {
        console.error('Error checking device status:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to check device status: ' + error.message,
            background: '#141414',
            color: '#ffffff'
        });
    }
}

// Edit device function
function editDevice(device) {
    // Populate form with device data
    document.getElementById('deviceId').value = device.device_id || '';
    document.getElementById('webhookId').value = device.webhook_id || '';
    document.getElementById('phoneNumber').value = device.phone_number || '';
    document.getElementById('apiKey').value = device.api_key || '';
    document.getElementById('idDevice').value = device.id_device || '';
    document.getElementById('idErp').value = device.id_erp || '';
    document.getElementById('idAdmin').value = device.id_admin || '';

    // Set radio buttons
    const apiKeyOption = document.querySelector(`input[name="apiKeyOption"][value="${device.api_key_option}"]`);
    if (apiKeyOption) apiKeyOption.checked = true;

    const provider = document.querySelector(`input[name="provider"][value="${device.provider}"]`);
    if (provider) provider.checked = true;

    // Change modal title
    document.querySelector('.modal-title').textContent = 'Edit Device';

    // Store device ID for update
    window.editingDeviceId = device.id;

    // Open modal
    openDeviceModal();
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
            // Token is invalid, redirect to login
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
        // On error, redirect to login
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
    // Check authentication and load user info first
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    loadUserInfo();
    loadDevices();

    // Add input restriction to phone number field
    const phoneInput = document.getElementById('phoneNumber');
    if (phoneInput) {
        phoneInput.addEventListener('input', restrictToNumbers);
    }
});
