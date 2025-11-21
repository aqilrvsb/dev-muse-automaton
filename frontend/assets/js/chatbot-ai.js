// Chatbot AI JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Store all conversations for filtering
let allConversations = [];
let filteredConversations = [];

// Load conversations from ai_whatsapp table
async function loadConversations() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        // Call single endpoint to get all conversations
        const response = await fetch(`${API_BASE_URL}/conversations/all`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success && data.conversations && data.conversations.length > 0) {
            allConversations = data.conversations;
            filteredConversations = [...allConversations];

            // Populate filter dropdowns
            populateFilters();

            // Calculate and display analytics
            calculateAnalytics(allConversations);

            // Display table
            displayConversations(filteredConversations);
        } else {
            const conversationsList = document.getElementById('conversationsList');
            conversationsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <h2 class="empty-state-title">No Conversations Yet</h2>
                    <p class="empty-state-text">Start a conversation with your Chatbot AI to see it here</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load conversations error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Failed to load conversations',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Populate filter dropdowns
function populateFilters() {
    // Get unique devices
    const devices = [...new Set(allConversations.map(c => c.id_device).filter(Boolean))];
    const deviceFilter = document.getElementById('deviceFilter');
    deviceFilter.innerHTML = '<option value="">All Devices</option>' +
        devices.map(d => `<option value="${d}">${d}</option>`).join('');

    // Get unique stages
    const stages = [...new Set(allConversations.map(c => c.stage || 'Welcome Message'))];
    const stageFilter = document.getElementById('stageFilter');
    stageFilter.innerHTML = '<option value="">All Stages</option>' +
        stages.map(s => `<option value="${s}">${s}</option>`).join('');
}

// Display conversations in table
function displayConversations(conversations) {
    const conversationsList = document.getElementById('conversationsList');

    if (conversations.length === 0) {
        conversationsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h2 class="empty-state-title">No Results Found</h2>
                <p class="empty-state-text">Try adjusting your filters or search criteria</p>
            </div>
        `;
        return;
    }

    conversationsList.innerHTML = `
        <div class="table-container">
            <table class="devices-table">
                <thead>
                    <tr>
                        <th>No</th>
                        <th>ID Device</th>
                        <th>Date</th>
                        <th>Name</th>
                        <th>Phone Number</th>
                        <th>Niche</th>
                        <th>Stage</th>
                        <th>Detail</th>
                        <th>Conversation History</th>
                        <th>Close</th>
                        <th>Total Price</th>
                        <th>Reply Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${conversations.map((conv, index) => {
                        // Format date to d-m-Y
                        let dateFormatted = '-';
                        if (conv.created_at) {
                            const date = new Date(conv.created_at);
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            dateFormatted = `${day}-${month}-${year}`;
                        }

                        // Reply Status: 0 = AI, 1 = Human
                        const replyStatus = conv.human === 1 ? 'Human' : 'AI';
                        const replyBadgeClass = conv.human === 1 ? 'badge-human' : 'badge-ai';

                        // Close Status: Check if stage contains "Close" or similar keywords
                        const isClosed = conv.stage && (
                            conv.stage.toLowerCase().includes('close') ||
                            conv.stage.toLowerCase().includes('completed') ||
                            conv.stage.toLowerCase().includes('done')
                        );
                        const closeStatus = isClosed ? 'YES' : 'NO';
                        const closeBadgeClass = isClosed ? 'badge-close-yes' : 'badge-close-no';

                        // Total Price: Extract from detail field or set default
                        let totalPrice = 'RM 0';
                        if (conv.detail) {
                            // Try to extract price from detail (format: HARGA: RM120 or PRICE: 120)
                            const priceMatch = conv.detail.match(/(?:HARGA|PRICE|TOTAL):\s*(?:RM\s*)?(\d+(?:\.\d{2})?)/i);
                            if (priceMatch) {
                                totalPrice = `RM ${priceMatch[1]}`;
                            }
                        }

                        return `
                            <tr>
                                <td><strong>${index + 1}</strong></td>
                                <td>${conv.id_device || '-'}</td>
                                <td>${dateFormatted}</td>
                                <td>${conv.prospect_name || '-'}</td>
                                <td><strong>${conv.prospect_num || '-'}</strong></td>
                                <td><span class="badge badge-niche">${conv.niche || '-'}</span></td>
                                <td><span class="badge badge-stage">${conv.stage || 'Welcome Message'}</span></td>
                                <td>
                                    <button class="btn-view-detail" onclick='viewDetail(${JSON.stringify(conv.detail || '').replace(/'/g, "&#39;")})' title="View Details">📋</button>
                                </td>
                                <td>
                                    <button class="btn-view" onclick='viewConversation(${JSON.stringify(conv).replace(/'/g, "&#39;")})' title="View Conversation History">👁️</button>
                                </td>
                                <td><span class="badge ${closeBadgeClass}">${closeStatus}</span></td>
                                <td><strong style="color: #4CAF50;">${totalPrice}</strong></td>
                                <td><span class="badge ${replyBadgeClass}">${replyStatus}</span></td>
                                <td>
                                    <button class="btn-delete" onclick="deleteConversation('${conv.prospect_num}')" title="Delete">🗑️</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Filter conversations
function applyFilters() {
    const deviceFilter = document.getElementById('deviceFilter').value;
    const stageFilter = document.getElementById('stageFilter').value;
    const startDateFilter = document.getElementById('startDateFilter').value;
    const endDateFilter = document.getElementById('endDateFilter').value;
    const searchInput = document.getElementById('searchInput').value.toLowerCase();

    filteredConversations = allConversations.filter(conv => {
        // Device filter
        if (deviceFilter && conv.id_device !== deviceFilter) return false;

        // Stage filter
        const convStage = conv.stage || 'Welcome Message';
        if (stageFilter && convStage !== stageFilter) return false;

        // Date range filter (Y-m-d format)
        if ((startDateFilter || endDateFilter) && conv.created_at) {
            const convDate = new Date(conv.created_at);
            const year = convDate.getFullYear();
            const month = String(convDate.getMonth() + 1).padStart(2, '0');
            const day = String(convDate.getDate()).padStart(2, '0');
            const convDateStr = `${year}-${month}-${day}`;

            // Check start date
            if (startDateFilter && convDateStr < startDateFilter) return false;

            // Check end date
            if (endDateFilter && convDateStr > endDateFilter) return false;
        }

        // Search filter (search in name, phone, niche)
        if (searchInput) {
            const searchMatch =
                (conv.prospect_name && conv.prospect_name.toLowerCase().includes(searchInput)) ||
                (conv.prospect_num && conv.prospect_num.toLowerCase().includes(searchInput)) ||
                (conv.niche && conv.niche.toLowerCase().includes(searchInput));
            if (!searchMatch) return false;
        }

        return true;
    });

    // Update analytics based on filtered data
    calculateAnalytics(filteredConversations);

    // Display filtered conversations
    displayConversations(filteredConversations);
}

// Reset filters
function resetFilters() {
    document.getElementById('deviceFilter').value = '';
    document.getElementById('stageFilter').value = '';
    setDefaultDates(); // Reset to default dates
    document.getElementById('searchInput').value = '';
    filteredConversations = [...allConversations];

    // Update analytics based on all conversations
    calculateAnalytics(allConversations);

    // Display all conversations
    displayConversations(filteredConversations);
}

// Export to CSV
function exportToCSV() {
    if (filteredConversations.length === 0) {
        Swal.fire({
            title: 'No Data',
            text: 'No conversations to export',
            icon: 'warning',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
        return;
    }

    // CSV headers
    let csv = 'No,ID Device,Date,Name,Phone Number,Niche,Stage,Conversation History,Reply Status\n';

    // CSV rows
    filteredConversations.forEach((conv, index) => {
        // Format date to d-m-Y
        let dateFormatted = '-';
        if (conv.created_at) {
            const date = new Date(conv.created_at);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            dateFormatted = `${day}-${month}-${year}`;
        }

        const replyStatus = conv.human === 1 ? 'Human' : 'AI';

        // Clean conversation history for CSV (keep line breaks, escape quotes)
        let convHistory = conv.conv_last || '';
        convHistory = convHistory.replace(/"/g, '""');

        csv += `${index + 1},"${conv.id_device || '-'}","${dateFormatted}","${conv.prospect_name || '-'}","${conv.prospect_num || '-'}","${conv.niche || '-'}","${conv.stage || 'Welcome Message'}","${convHistory}","${replyStatus}"\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-ai-conversations-${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    Swal.fire({
        title: 'Success!',
        text: 'Conversations exported successfully',
        icon: 'success',
        background: '#141414',
        color: '#ffffff',
        confirmButtonColor: '#e50914',
        timer: 2000
    });
}

// View conversation details
function viewConversation(conv) {
    let convHistory = 'No conversation history';
    if (conv.conv_last) {
        convHistory = conv.conv_last.replace(/\n/g, '<br>');
    }

    Swal.fire({
        title: `Conversation History`,
        html: `
            <style>
                .conversation-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                .conversation-scroll::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }
                .conversation-scroll::-webkit-scrollbar-thumb {
                    background: rgba(229, 9, 20, 0.3);
                    border-radius: 4px;
                }
                .conversation-scroll::-webkit-scrollbar-thumb:hover {
                    background: rgba(229, 9, 20, 0.5);
                }
            </style>
            <div style="text-align: left; color: #ffffff;">
                <p><strong>Phone:</strong> ${conv.prospect_num || '-'}</p>
                <p><strong>Name:</strong> ${conv.prospect_name || '-'}</p>
                <p><strong>Device:</strong> ${conv.id_device || '-'}</p>
                <p><strong>Niche:</strong> ${conv.niche || '-'}</p>
                <p><strong>Stage:</strong> ${conv.stage || 'Welcome Message'}</p>
                <hr style="border-color: #333;">
                <p><strong>Conversation:</strong></p>
                <div class="conversation-scroll" style="background: #1a1a1a; padding: 10px; border-radius: 5px; max-height: 300px; overflow-y: auto;">
                    ${convHistory}
                </div>
            </div>
        `,
        width: '700px',
        background: '#141414',
        color: '#ffffff',
        confirmButtonColor: '#e50914',
        confirmButtonText: 'Close'
    });
}

// View detail information
function viewDetail(detail) {
    let detailContent = 'No details available';
    if (detail && detail.trim()) {
        detailContent = detail.replace(/\n/g, '<br>');
    }

    Swal.fire({
        title: 'Customer Details',
        html: `
            <div style="text-align: left; color: #ffffff;">
                <div style="background: #1a1a1a; padding: 15px; border-radius: 5px; max-height: 400px; overflow-y: auto;">
                    ${detailContent}
                </div>
            </div>
        `,
        width: '600px',
        background: '#141414',
        color: '#ffffff',
        confirmButtonColor: '#e50914',
        confirmButtonText: 'Close'
    });
}

// Delete conversation
async function deleteConversation(prospectNum) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        background: '#141414',
        color: '#ffffff',
        confirmButtonColor: '#e50914',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/conversations/${prospectNum}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                title: 'Deleted!',
                text: 'Conversation has been deleted.',
                icon: 'success',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914',
                timer: 2000
            });

            // Reload conversations
            loadConversations();
        } else {
            Swal.fire({
                title: 'Error!',
                text: data.message || 'Failed to delete conversation',
                icon: 'error',
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914'
            });
        }
    } catch (error) {
        console.error('Delete conversation error:', error);
        Swal.fire({
            title: 'Error!',
            text: 'Failed to delete conversation',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    }
}

// Calculate and display analytics
let dailyTrendsChart = null;

function calculateAnalytics(conversations) {
    if (!conversations || conversations.length === 0) {
        return;
    }

    // Total conversations
    const total = conversations.length;
    document.getElementById('totalConversations').textContent = total;

    // AI vs Human conversations
    const aiConvs = conversations.filter(c => !c.human || c.human === 0).length;
    const humanConvs = conversations.filter(c => c.human === 1).length;

    document.getElementById('aiConversations').textContent = aiConvs;
    document.getElementById('humanConversations').textContent = humanConvs;

    const aiPercent = ((aiConvs / total) * 100).toFixed(1);
    const humanPercent = ((humanConvs / total) * 100).toFixed(1);

    document.getElementById('aiChange').textContent = `${aiPercent}% of total`;
    document.getElementById('humanChange').textContent = `${humanPercent}% of total`;

    // Active devices
    const uniqueDevices = [...new Set(conversations.map(c => c.id_device))].length;
    document.getElementById('activeDevices').textContent = uniqueDevices;

    // Render charts
    renderDailyTrendsChart(conversations);
    renderStageDistribution(conversations);
}

// Render daily trends chart
function renderDailyTrendsChart(conversations) {
    const ctx = document.getElementById('dailyTrendsChart');
    if (!ctx) return;

    // Group conversations by date
    const dateGroups = {};
    conversations.forEach(conv => {
        if (conv.created_at) {
            const date = new Date(conv.created_at);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            dateGroups[dateStr] = (dateGroups[dateStr] || 0) + 1;
        }
    });

    // Get last 7 days
    const labels = [];
    const data = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        labels.push(dateStr);
        data.push(dateGroups[dateStr] || 0);
    }

    // Destroy previous chart if exists
    if (dailyTrendsChart) {
        dailyTrendsChart.destroy();
    }

    // Create new chart
    dailyTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Conversations',
                data: data,
                borderColor: '#e50914',
                backgroundColor: 'rgba(229, 9, 20, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff',
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// Render stage distribution
function renderStageDistribution(conversations) {
    const stageDistDiv = document.getElementById('stageDistribution');
    if (!stageDistDiv) return;

    // Count conversations by stage
    const stageCounts = {};
    conversations.forEach(conv => {
        const stage = conv.stage || 'Welcome Message';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    // Sort by count
    const sortedStages = Object.entries(stageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5 stages

    const total = conversations.length;

    // Render as horizontal bars
    stageDistDiv.innerHTML = sortedStages.map(([stage, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
            <div class="stage-bar-item">
                <div class="stage-bar-label">
                    <span class="stage-name">${stage}</span>
                    <span class="stage-count">${count} conversations</span>
                </div>
                <div class="stage-bar-wrapper">
                    <div class="stage-bar-fill" style="width: ${percentage}%"></div>
                    <span class="stage-percentage">${percentage}%</span>
                </div>
            </div>
        `;
    }).join('');
}

// Refresh stage chart
function refreshStageChart() {
    renderStageDistribution(allConversations);
}

// Set default date filters
function setDefaultDates() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // Start date: first day of current month
    const startDate = `${year}-${month}-01`;
    document.getElementById('startDateFilter').value = startDate;

    // End date: current date
    const endDate = `${year}-${month}-${day}`;
    document.getElementById('endDateFilter').value = endDate;
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
    setDefaultDates();
    loadConversations();
});
