// State
let currentSiteId = 'site-1';
let chartInstance = null;

// DOM Elements
const dateSelector = document.getElementById('dateSelector');
const refreshBtn = document.getElementById('refreshBtn');
const totalViewsEl = document.getElementById('totalViews');
const uniqueUsersEl = document.getElementById('uniqueUsers');
const statusTextEl = document.getElementById('statusText');
const statusBanner = document.getElementById('statusBanner');

// Initialize Date to Today
const today = new Date().toISOString().slice(0, 10);
dateSelector.value = today;

// Fetch Data from Reporting API
async function fetchAnalytics(date) {
    totalViewsEl.textContent = '...';
    uniqueUsersEl.textContent = '...';
    
    try {
        const response = await fetch(`/stats?site_id=${currentSiteId}&date=${date}`);
        const data = await response.json();
        
        if (data.error) {
            handleNoData();
            updateStatus('No Data Found', '#d73a49'); // Red
            return;
        }

        renderMetrics(data);
        renderChart(data.top_paths);
        updateStatus('Systems Active & Synced', '#2ea043'); // Green
        
    } catch (err) {
        console.error('Failed to fetch analytics:', err);
        handleNoData();
        updateStatus('Reporting API Offline (Check Port 4001)', '#d73a49');
    }
}

// Update UI
function renderMetrics(data) {
    totalViewsEl.textContent = data.total_views.toLocaleString();
    uniqueUsersEl.textContent = data.unique_users.toLocaleString();
}

function handleNoData() {
    totalViewsEl.textContent = '0';
    uniqueUsersEl.textContent = '0';
    renderChart([]);
}

function updateStatus(message, color) {
    statusTextEl.textContent = message;
    statusBanner.style.backgroundColor = `${color}1A`; // 10% opacity
    statusBanner.style.borderColor = `${color}33`; // 20% opacity
    statusBanner.querySelector('.status-dot').style.backgroundColor = color;
    statusBanner.querySelector('.status-dot').style.boxShadow = `0 0 8px ${color}`;
}

// Render Chart.js
function renderChart(pathsData) {
    const ctx = document.getElementById('pathsChart').getContext('2d');
    
    const labels = pathsData.map(p => p.path);
    const dataValues = pathsData.map(p => p.views);

    if (chartInstance) {
        chartInstance.destroy();
    }

    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Inter', sans-serif";

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
                label: 'Views',
                data: dataValues.length ? dataValues : [0],
                backgroundColor: 'rgba(88, 166, 255, 0.6)',
                borderColor: 'rgba(88, 166, 255, 1)',
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(88, 166, 255, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.9)',
                    titleColor: '#e6edf3',
                    bodyColor: '#e6edf3',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.raw + ' views';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                }
            }
        }
    });
}

// Event Listeners
refreshBtn.addEventListener('click', () => fetchAnalytics(dateSelector.value));
dateSelector.addEventListener('change', () => fetchAnalytics(dateSelector.value));

// Auto-refresh every 5 seconds for a dynamic feel
setInterval(() => {
    fetchAnalytics(dateSelector.value);
}, 5000);

// Init
fetchAnalytics(dateSelector.value);
