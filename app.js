// MediTrack Application Logic

// Global Variables
let medicines = [];
let adherenceData = [];
let chart = null;

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupEventListeners();
    checkNotificationPermission();
    updateUI();
    initChart();
    checkReminders();
    setInterval(checkReminders, 60000); // Check every minute
});

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('medicineForm').addEventListener('submit', addMedicine);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

// Load Data from LocalStorage
function loadData() {
    const savedMedicines = localStorage.getItem('medicines');
    const savedAdherence = localStorage.getItem('adherence');
    
    if (savedMedicines) {
        medicines = JSON.parse(savedMedicines);
    }
    
    if (savedAdherence) {
        adherenceData = JSON.parse(savedAdherence);
    } else {
        // Initialize with last 7 days
        adherenceData = getLast7Days();
    }
}

// Save Data to LocalStorage
function saveData() {
    localStorage.setItem('medicines', JSON.stringify(medicines));
    localStorage.setItem('adherence', JSON.stringify(adherenceData));
}

// Add Medicine
function addMedicine(e) {
    e.preventDefault();
    
    const medicine = {
        id: Date.now(),
        name: document.getElementById('medName').value,
        dosage: document.getElementById('medDosage').value,
        time: document.getElementById('medTime').value,
        frequency: document.getElementById('medFrequency').value,
        notes: document.getElementById('medNotes').value,
        lastTaken: null,
        adherence: []
    };
    
    medicines.push(medicine);
    saveData();
    updateUI();
    
    // Reset form
    document.getElementById('medicineForm').reset();
    
    // Show success message
    showNotification('Medicine added successfully!', 'success');
}

// Delete Medicine
function deleteMedicine(id) {
    if (confirm('Are you sure you want to delete this medicine?')) {
        medicines = medicines.filter(med => med.id !== id);
        saveData();
        updateUI();
        showNotification('Medicine deleted', 'info');
    }
}

// Mark Medicine as Taken
function markAsTaken(id) {
    const medicine = medicines.find(med => med.id === id);
    if (medicine) {
        const today = new Date().toDateString();
        const now = new Date().toLocaleTimeString('en-US', { hour12: false });
        
        medicine.lastTaken = today;
        
        if (!medicine.adherence) {
            medicine.adherence = [];
        }
        
        medicine.adherence.push({
            date: today,
            time: now,
            status: 'taken'
        });
        
        updateAdherenceData(today, 'taken');
        saveData();
        updateUI();
        updateChart();
        
        showNotification(`${medicine.name} marked as taken!`, 'success');
    }
}

// Update Adherence Data
function updateAdherenceData(date, status) {
    const dayData = adherenceData.find(d => d.date === date);
    
    if (dayData) {
        if (status === 'taken') {
            dayData.taken++;
        } else {
            dayData.missed++;
        }
    } else {
        adherenceData.push({
            date: date,
            taken: status === 'taken' ? 1 : 0,
            missed: status === 'missed' ? 1 : 0
        });
    }
    
    // Keep only last 30 days
    if (adherenceData.length > 30) {
        adherenceData = adherenceData.slice(-30);
    }
}

// Update UI
function updateUI() {
    updateStats();
    displayMedicines();
    displaySchedule();
}

// Update Statistics
function updateStats() {
    const totalMeds = medicines.length;
    const today = new Date().toDateString();
    
    // Count today's doses
    let todayDoses = 0;
    medicines.forEach(med => {
        if (med.frequency === 'daily') todayDoses += 1;
        else if (med.frequency === 'twice') todayDoses += 2;
        else if (med.frequency === 'thrice') todayDoses += 3;
    });
    
    // Calculate adherence rate
    let totalTaken = 0;
    let totalExpected = 0;
    
    adherenceData.slice(-7).forEach(day => {
        totalTaken += day.taken;
        totalExpected += day.taken + day.missed;
    });
    
    const adherenceRate = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0;
    
    document.getElementById('totalMeds').textContent = totalMeds;
    document.getElementById('todayDoses').textContent = todayDoses;
    document.getElementById('adherenceRate').textContent = adherenceRate + '%';
}

// Display Medicines
function displayMedicines() {
    const container = document.getElementById('medicineContainer');
    
    if (medicines.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>💊</span>
                <p>No medicines added yet. Add your first medicine above!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = medicines.map(med => `
        <div class="medicine-card">
            <div class="medicine-header">
                <div class="medicine-info">
                    <h3>${med.name}</h3>
                    <p>${med.dosage}</p>
                </div>
                <div class="medicine-actions">
                    <button class="btn-small btn-taken" onclick="markAsTaken(${med.id})">✓ Taken</button>
                    <button class="btn-small btn-delete" onclick="deleteMedicine(${med.id})">Delete</button>
                </div>
            </div>
            <div class="medicine-details">
                <div class="detail-item">
                    <span>⏰ Time:</span>
                    <span>${formatTime(med.time)}</span>
                </div>
                <div class="detail-item">
                    <span>📅 Frequency:</span>
                    <span>${capitalize(med.frequency)}</span>
                </div>
                ${med.lastTaken ? `
                <div class="detail-item">
                    <span>✓ Last Taken:</span>
                    <span>${formatDate(med.lastTaken)}</span>
                </div>
                ` : ''}
            </div>
            ${med.notes ? `<p style="margin-top: 10px; color: var(--text-light); font-size: 0.9rem;">📝 ${med.notes}</p>` : ''}
        </div>
    `).join('');
}

// Display Today's Schedule
function displaySchedule() {
    const container = document.getElementById('scheduleContainer');
    const today = new Date().toDateString();
    const currentTime = new Date().toTimeString().slice(0, 5);
    
    let schedule = [];
    
    medicines.forEach(med => {
        const times = getTimesForFrequency(med);
        times.forEach(time => {
            const isTaken = med.adherence && med.adherence.some(
                a => a.date === today && a.time.slice(0, 5) === time
            );
            
            schedule.push({
                time: time,
                medicine: med,
                status: isTaken ? 'taken' : (time < currentTime ? 'missed' : 'pending')
            });
        });
    });
    
    // Sort by time
    schedule.sort((a, b) => a.time.localeCompare(b.time));
    
    if (schedule.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>📅</span>
                <p>No medicines scheduled for today</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = schedule.map(item => `
        <div class="schedule-item">
            <div class="schedule-time">${formatTime(item.time)}</div>
            <div class="schedule-med">
                <h4>${item.medicine.name}</h4>
                <p>${item.medicine.dosage}</p>
            </div>
            <span class="status-badge status-${item.status}">${capitalize(item.status)}</span>
        </div>
    `).join('');
}

// Get times based on frequency
function getTimesForFrequency(med) {
    const baseTime = med.time;
    
    if (med.frequency === 'daily') {
        return [baseTime];
    } else if (med.frequency === 'twice') {
        const [h, m] = baseTime.split(':');
        const time2 = `${(parseInt(h) + 8) % 24}:${m}`;
        return [baseTime, time2];
    } else if (med.frequency === 'thrice') {
        const [h, m] = baseTime.split(':');
        const time2 = `${(parseInt(h) + 6) % 24}:${m}`;
        const time3 = `${(parseInt(h) + 12) % 24}:${m}`;
        return [baseTime, time2, time3];
    }
    
    return [baseTime];
}

// Initialize Chart
function initChart() {
    const ctx = document.getElementById('adherenceChart').getContext('2d');
    
    const last7Days = adherenceData.slice(-7);
    const labels = last7Days.map(d => formatDateShort(d.date));
    const takenData = last7Days.map(d => d.taken);
    const missedData = last7Days.map(d => d.missed);
    
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Taken',
                    data: takenData,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Missed',
                    data: missedData,
                    backgroundColor: '#ef4444',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Update Chart
function updateChart() {
    if (chart) {
        const last7Days = adherenceData.slice(-7);
        chart.data.labels = last7Days.map(d => formatDateShort(d.date));
        chart.data.datasets[0].data = last7Days.map(d => d.taken);
        chart.data.datasets[1].data = last7Days.map(d => d.missed);
        chart.update();
    }
}

// Check Reminders
function checkReminders() {
    const currentTime = new Date().toTimeString().slice(0, 5);
    const today = new Date().toDateString();
    
    medicines.forEach(med => {
        const times = getTimesForFrequency(med);
        
        times.forEach(time => {
            if (time === currentTime) {
                const alreadyTaken = med.adherence && med.adherence.some(
                    a => a.date === today && a.time.slice(0, 5) === time
                );
                
                if (!alreadyTaken) {
                    sendNotification(med);
                }
            }
        });
    });
}

// Send Browser Notification
function sendNotification(medicine) {
    if (Notification.permission === 'granted') {
        new Notification('MediTrack Reminder', {
            body: `Time to take ${medicine.name} - ${medicine.dosage}`,
            icon: '💊',
            tag: medicine.id
        });
    }
}

// Check Notification Permission
function checkNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            document.getElementById('notificationModal').classList.add('active');
        }
    }
}

// Request Notification Permission
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showNotification('Notifications enabled!', 'success');
            }
            closeModal();
        });
    }
}

// Close Modal
function closeModal() {
    document.getElementById('notificationModal').classList.remove('active');
}

// Show In-App Notification
function showNotification(message, type) {
    // Simple alert for now - can be enhanced with toast notifications
    console.log(`${type.toUpperCase()}: ${message}`);
}

// Toggle Theme
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load Theme Preference
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeToggle').textContent = '☀️';
}

// Utility Functions
function formatTime(time) {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

function formatDateShort(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push({
            date: date.toDateString(),
            taken: 0,
            missed: 0
        });
    }
    return days;
}