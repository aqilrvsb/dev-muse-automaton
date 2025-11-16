// Dashboard JavaScript
const API_BASE_URL = window.location.origin + '/api';

// Store all data
let allChatbotAI = [];
let allWhatsappBot = [];
let filteredChatbotAI = [];
let filteredWhatsappBot = [];

// Chart instances
let combinedTrendsChart = null;
let chatbotAIStageChart = null;
let whatsappBotStageChart = null;
let deviceDistributionChart = null;
let sourceComparisonChart = null;

// Initialize dashboard (auth already checked in dashboard.html)
document.addEventListener('DOMContentLoaded', () => {
    // Auth already verified in dashboard.html before this script loads
    // No need to check again - just initialize the dashboard

    // Load user info
    loadUserInfo();

    // Set default dates
    setDefaultDates();

    // Load dashboard data
    loadDashboardData();
});

// Load user info using Supabase (NO localStorage)
async function loadUserInfo() {
    try {
        const userProfile = await window.getCurrentUserProfile();

        if (userProfile && userProfile.email) {
            document.getElementById('userEmail').textContent = userProfile.email;

            // Show Packages tab for admin users
            if (userProfile.email === 'Admin@gmail.com' || userProfile.role === 'admin') {
                const packagesTab = document.getElementById('packagesTab');
                if (packagesTab) {
                    packagesTab.style.display = 'flex';
                }
            }

            // Update system status based on user status and expiration date
            updateSystemStatus(userProfile);
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Update system status display
function updateSystemStatus(user) {
    const statusElement = document.getElementById('systemStatus');
    if (!statusElement) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

    let displayStatus = 'System Online';

    // Check if user has expired date
    if (user.expired) {
        const expiredDate = new Date(user.expired);
        expiredDate.setHours(0, 0, 0, 0); // Reset time to start of day

        // If today is after expired date, show Expired
        if (today > expiredDate) {
            displayStatus = 'System Online (Expired)';
        } else {
            // Check status - display as-is from database
            if (user.status === 'Pro') {
                displayStatus = 'System Online (Pro)';
            } else if (user.status === 'Trial') {
                displayStatus = 'System Online (Trial)';
            } else {
                displayStatus = `System Online (${user.status})`;
            }
        }
    } else {
        // No expiration date, just show status
        if (user.status === 'Pro') {
            displayStatus = 'System Online (Pro)';
        } else if (user.status === 'Trial') {
            displayStatus = 'System Online (Trial)';
        } else {
            displayStatus = `System Online (${user.status})`;
        }
    }

    statusElement.textContent = displayStatus;
}

// Set default date filters (current month)
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

// Load combined dashboard data
async function loadDashboardData() {
    try {
        // Use Supabase direct queries instead of API calls
        const { data: chatbotData, error: chatbotError } = await window.supabase
            .from('ai_whatsapp')
            .select('*');

        const { data: whatsappData, error: whatsappError } = await window.supabase
            .from('wasapbot')
            .select('*');

        if (chatbotError) console.error('Error loading chatbot data:', chatbotError);
        if (whatsappError) console.error('Error loading whatsapp data:', whatsappError);

        allChatbotAI = chatbotData || [];
        allWhatsappBot = whatsappData || [];

        filteredChatbotAI = [...allChatbotAI];
        filteredWhatsappBot = [...allWhatsappBot];

        // Populate filter dropdowns
        populateFilters();

        // Calculate and display analytics
        calculateAnalytics();

        // Render all charts
        renderAllCharts();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        Swal.fire({
            title: 'Error',
            text: 'Failed to load dashboard data',
            icon: 'error',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#a855f7'
        });
    }
}

// Populate filter dropdowns
function populateFilters() {
    // Get unique devices from both sources
    const chatbotDevices = [...new Set(allChatbotAI.map(c => c.id_device).filter(Boolean))];
    const wasapbotDevices = [...new Set(allWhatsappBot.map(c => c.id_device).filter(Boolean))];
    const allDevices = [...new Set([...chatbotDevices, ...wasapbotDevices])].sort();

    const deviceFilter = document.getElementById('deviceFilter');
    deviceFilter.innerHTML = '<option value="">All Devices</option>';
    allDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device;
        option.textContent = device;
        deviceFilter.appendChild(option);
    });

    // Get unique stages from both sources
    const chatbotStages = [...new Set(allChatbotAI.map(c => c.stage).filter(Boolean))];
    const wasapbotStages = [...new Set(allWhatsappBot.map(c => c.stage).filter(Boolean))];
    const allStages = [...new Set([...chatbotStages, ...wasapbotStages])].sort();

    const stageFilter = document.getElementById('stageFilter');
    stageFilter.innerHTML = '<option value="">All Stages</option>';
    allStages.forEach(stage => {
        const option = document.createElement('option');
        option.value = stage;
        option.textContent = stage;
        stageFilter.appendChild(option);
    });
}

// Apply filters
function applyFilters() {
    const deviceFilter = document.getElementById('deviceFilter').value;
    const stageFilter = document.getElementById('stageFilter').value;
    const startDateFilter = document.getElementById('startDateFilter').value;
    const endDateFilter = document.getElementById('endDateFilter').value;

    // Filter Chatbot AI
    filteredChatbotAI = allChatbotAI.filter(conv => {
        if (deviceFilter && conv.id_device !== deviceFilter) return false;
        if (stageFilter && conv.stage !== stageFilter) return false;

        if (startDateFilter || endDateFilter) {
            if (!conv.created_at) return false;
            const convDate = new Date(conv.created_at);
            const convDateStr = `${convDate.getFullYear()}-${String(convDate.getMonth() + 1).padStart(2, '0')}-${String(convDate.getDate()).padStart(2, '0')}`;

            if (startDateFilter && convDateStr < startDateFilter) return false;
            if (endDateFilter && convDateStr > endDateFilter) return false;
        }

        return true;
    });

    // Filter WhatsApp Bot
    filteredWhatsappBot = allWhatsappBot.filter(conv => {
        if (deviceFilter && conv.id_device !== deviceFilter) return false;
        if (stageFilter && conv.stage !== stageFilter) return false;

        if (startDateFilter || endDateFilter) {
            if (!conv.created_at) return false;
            const convDate = new Date(conv.created_at);
            const convDateStr = `${convDate.getFullYear()}-${String(convDate.getMonth() + 1).padStart(2, '0')}-${String(convDate.getDate()).padStart(2, '0')}`;

            if (startDateFilter && convDateStr < startDateFilter) return false;
            if (endDateFilter && convDateStr > endDateFilter) return false;
        }

        return true;
    });

    // Recalculate analytics and re-render charts
    calculateAnalytics();
    renderAllCharts();
}

// Reset filters
function resetFilters() {
    document.getElementById('deviceFilter').value = '';
    document.getElementById('stageFilter').value = '';
    setDefaultDates();

    filteredChatbotAI = [...allChatbotAI];
    filteredWhatsappBot = [...allWhatsappBot];

    calculateAnalytics();
    renderAllCharts();
}

// Calculate analytics
function calculateAnalytics() {
    const totalChatbot = filteredChatbotAI.length;
    const totalWasapbot = filteredWhatsappBot.length;
    const totalConversations = totalChatbot + totalWasapbot;

    document.getElementById('totalConversations').textContent = totalConversations;
    document.getElementById('chatbotAICount').textContent = totalChatbot;
    document.getElementById('whatsappBotCount').textContent = totalWasapbot;

    if (totalConversations > 0) {
        const chatbotPercent = ((totalChatbot / totalConversations) * 100).toFixed(1);
        const wasapbotPercent = ((totalWasapbot / totalConversations) * 100).toFixed(1);

        document.getElementById('chatbotAIPercent').textContent = `${chatbotPercent}% of total`;
        document.getElementById('whatsappBotPercent').textContent = `${wasapbotPercent}% of total`;
    } else {
        document.getElementById('chatbotAIPercent').textContent = '0% of total';
        document.getElementById('whatsappBotPercent').textContent = '0% of total';
    }

    // Active devices
    const chatbotDevices = new Set(filteredChatbotAI.map(c => c.id_device).filter(Boolean));
    const wasapbotDevices = new Set(filteredWhatsappBot.map(c => c.id_device).filter(Boolean));
    const uniqueDevices = new Set([...chatbotDevices, ...wasapbotDevices]);
    document.getElementById('activeDevices').textContent = uniqueDevices.size;
}

// Render all charts
function renderAllCharts() {
    renderCombinedTrendsChart();
    renderChatbotAIStageChart();
    renderWhatsappBotStageChart();
    renderDeviceDistributionChart();
    renderSourceComparisonChart();
}

// Render combined line chart
function renderCombinedTrendsChart() {
    const ctx = document.getElementById('combinedTrendsChart');
    if (!ctx) return;

    // Get last 7 days
    const labels = [];
    const chatbotData = [];
    const wasapbotData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        labels.push(dateStr);

        // Count chatbot AI conversations for this date
        const chatbotCount = filteredChatbotAI.filter(conv => {
            if (!conv.created_at) return false;
            const convDate = new Date(conv.created_at);
            return convDate.toDateString() === d.toDateString();
        }).length;
        chatbotData.push(chatbotCount);

        // Count WhatsApp Bot conversations for this date
        const wasapbotCount = filteredWhatsappBot.filter(conv => {
            if (!conv.created_at) return false;
            const convDate = new Date(conv.created_at);
            return convDate.toDateString() === d.toDateString();
        }).length;
        wasapbotData.push(wasapbotCount);
    }

    // Destroy previous chart
    if (combinedTrendsChart) {
        combinedTrendsChart.destroy();
    }

    // Create chart
    combinedTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Chatbot AI',
                    data: chatbotData,
                    borderColor: '#f093fb',
                    backgroundColor: 'rgba(240, 147, 251, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'WhatsApp Bot',
                    data: wasapbotData,
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#ffffff' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#ffffff', stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#ffffff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

// Render Chatbot AI stage chart
function renderChatbotAIStageChart() {
    const ctx = document.getElementById('chatbotAIStageChart');
    if (!ctx) return;

    // Group by stage
    const stageGroups = {};
    filteredChatbotAI.forEach(conv => {
        const stage = conv.stage || 'Welcome Message';
        stageGroups[stage] = (stageGroups[stage] || 0) + 1;
    });

    const stages = Object.keys(stageGroups).sort();
    const counts = stages.map(stage => stageGroups[stage]);

    // Destroy previous chart
    if (chatbotAIStageChart) {
        chatbotAIStageChart.destroy();
    }

    // Create chart
    chatbotAIStageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: stages,
            datasets: [{
                label: 'Conversations',
                data: counts,
                backgroundColor: 'rgba(240, 147, 251, 0.8)',
                borderColor: '#f093fb',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#ffffff', stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#ffffff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

// Render WhatsApp Bot stage chart
function renderWhatsappBotStageChart() {
    const ctx = document.getElementById('whatsappBotStageChart');
    if (!ctx) return;

    // Group by stage
    const stageGroups = {};
    filteredWhatsappBot.forEach(conv => {
        const stage = conv.stage || 'Welcome Message';
        stageGroups[stage] = (stageGroups[stage] || 0) + 1;
    });

    const stages = Object.keys(stageGroups).sort();
    const counts = stages.map(stage => stageGroups[stage]);

    // Destroy previous chart
    if (whatsappBotStageChart) {
        whatsappBotStageChart.destroy();
    }

    // Create chart
    whatsappBotStageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: stages,
            datasets: [{
                label: 'Conversations',
                data: counts,
                backgroundColor: 'rgba(79, 172, 254, 0.8)',
                borderColor: '#4facfe',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#ffffff', stepSize: 1 },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#ffffff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

// Render device distribution chart
function renderDeviceDistributionChart() {
    const ctx = document.getElementById('deviceDistributionChart');
    if (!ctx) return;

    // Group by device
    const deviceGroups = {};
    [...filteredChatbotAI, ...filteredWhatsappBot].forEach(conv => {
        const device = conv.id_device || 'Unknown';
        deviceGroups[device] = (deviceGroups[device] || 0) + 1;
    });

    const devices = Object.keys(deviceGroups).sort();
    const counts = devices.map(device => deviceGroups[device]);

    // Destroy previous chart
    if (deviceDistributionChart) {
        deviceDistributionChart.destroy();
    }

    // Create chart
    deviceDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: devices,
            datasets: [{
                data: counts,
                backgroundColor: [
                    'rgba(240, 147, 251, 0.8)',
                    'rgba(79, 172, 254, 0.8)',
                    'rgba(67, 233, 123, 0.8)',
                    'rgba(254, 215, 102, 0.8)',
                    'rgba(229, 9, 20, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: '#ffffff' }
                }
            }
        }
    });
}

// Render source comparison chart
function renderSourceComparisonChart() {
    const ctx = document.getElementById('sourceComparisonChart');
    if (!ctx) return;

    const chatbotCount = filteredChatbotAI.length;
    const wasapbotCount = filteredWhatsappBot.length;

    // Destroy previous chart
    if (sourceComparisonChart) {
        sourceComparisonChart.destroy();
    }

    // Create chart
    sourceComparisonChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Chatbot AI', 'WhatsApp Bot'],
            datasets: [{
                data: [chatbotCount, wasapbotCount],
                backgroundColor: [
                    'rgba(240, 147, 251, 0.8)',
                    'rgba(79, 172, 254, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: '#ffffff' }
                }
            }
        }
    });
}

// Logout function (uses Supabase, NO localStorage)
async function logout() {
    // Use the logout function from auth.js (made available globally)
    if (window.logout) {
        await window.logout();
    } else {
        // Fallback: direct Supabase logout
        await window.supabase.auth.signOut();
        window.location.href = '/';
    }
}
