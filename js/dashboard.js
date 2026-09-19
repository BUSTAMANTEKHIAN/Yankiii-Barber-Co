/**
 * Yankiii Barber Co. — Customer Dashboard Script
 * Manages upcoming bookings, history, and appointment cancellation.
 */

let myBookings = [];
let pendingCancelId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = window.api ? window.api.getUser() : null;
    const token = window.api ? window.api.getToken() : null;

    if (!user || !token) {
        window.location.href = 'login.html';
        return;
    }

    // Populate user profile info
    const firstName = user.name ? user.name.split(' ')[0] : 'Client';
    document.getElementById('dashUserName').textContent = firstName;
    document.getElementById('sidebarUserName').textContent = user.name || 'Client';
    document.getElementById('sidebarUserEmail').textContent = user.email || '';
    document.getElementById('userAvatarLetter').textContent = (user.name || 'U').charAt(0).toUpperCase();

    await loadMyBookings();
});

async function loadMyBookings() {
    try {
        const res = await window.api.get('/bookings/my');
        if (res.success && Array.isArray(res.data)) {
            myBookings = res.data;
            renderBookings();
            return;
        }
    } catch (e) {}

    myBookings = [];
    window.showToast('We couldn’t load your appointments. Please refresh.', 'error');
    renderBookings();
}

function renderBookings() {
    const upcomingContainer = document.getElementById('upcomingList');
    const historyContainer = document.getElementById('historyList');

    const todayStr = new Date().toISOString().split('T')[0];

    const upcoming = myBookings.filter(b => {
        const isFutureOrToday = b.booking_date >= todayStr;
        const isActiveStatus = (b.status === 'pending' || b.status === 'confirmed');
        return isFutureOrToday && isActiveStatus;
    });

    const history = myBookings.filter(b => {
        const isPast = b.booking_date < todayStr;
        const isTerminalStatus = (b.status === 'completed' || b.status === 'cancelled');
        return isPast || isTerminalStatus;
    });

    // Render Upcoming
    if (upcoming.length === 0) {
        upcomingContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-calendar"></i>
                <h3>No upcoming appointments</h3>
                <p>Ready for your next precision cut or fade?</p>
                <a href="booking.html" class="btn btn-primary btn-sm">Schedule Now</a>
            </div>
        `;
    } else {
        upcomingContainer.innerHTML = upcoming.map(b => renderAppointmentCard(b, true)).join('');
    }

    // Render History
    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <h3>No past appointments yet</h3>
                <p>Your finished and past bookings will appear here.</p>
            </div>
        `;
    } else {
        historyContainer.innerHTML = history.map(b => renderAppointmentCard(b, false)).join('');
    }
}

function renderAppointmentCard(b, isUpcoming) {
    const dateFormatted = new Date(b.booking_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const [hStr, mStr] = (b.start_time || '00:00').split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeFormatted = `${h}:${mStr} ${ampm}`;

    const statusBadgeClass = `badge-${b.status.toLowerCase()}`;

    const cancelButton = isUpcoming && b.status !== 'cancelled' ? `
        <button type="button" class="btn btn-sm btn-outline" style="border-color:#dc2626;color:#dc2626;" onclick="openCancelModal(${b.id})">
            <i class="fa-solid fa-xmark"></i> Cancel Appointment
        </button>
    ` : '';

    return `
        <article class="appointment-card">
            <div class="appointment-main-info">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                    <span style="font-family: monospace; font-weight: 700; font-size: 13px; color: #65705f;">
                        ${b.booking_reference}
                    </span>
                    <span class="badge ${statusBadgeClass}">${b.status}</span>
                </div>
                <h3>${b.service_name || 'Haircut Service'}</h3>
                <div class="appointment-meta-row">
                    <span><i class="fa-solid fa-user-tie"></i> ${b.barber_name || 'Barber'}</span>
                    <span><i class="fa-regular fa-calendar"></i> ${dateFormatted}</span>
                    <span><i class="fa-regular fa-clock"></i> ${timeFormatted} (${b.duration || 30} min)</span>
                    <span><i class="fa-solid fa-tag"></i> ₱${Number(b.total_price).toLocaleString()}</span>
                </div>
            </div>
            <div class="appointment-right-action">
                ${cancelButton}
            </div>
        </article>
    `;
}

// Tab Switching
window.switchTab = function (tabName) {
    const upcomingBtn = document.getElementById('tabBtnUpcoming');
    const historyBtn = document.getElementById('tabBtnHistory');
    const upcomingContent = document.getElementById('tabContentUpcoming');
    const historyContent = document.getElementById('tabContentHistory');

    if (tabName === 'upcoming') {
        upcomingBtn.classList.add('active');
        historyBtn.classList.remove('active');
        upcomingContent.style.display = 'block';
        historyContent.style.display = 'none';
    } else {
        historyBtn.classList.add('active');
        upcomingBtn.classList.remove('active');
        historyContent.style.display = 'block';
        upcomingContent.style.display = 'none';
    }
};

// Cancel Modal Handlers
window.openCancelModal = function (bookingId) {
    pendingCancelId = bookingId;
    document.getElementById('cancelModal').classList.add('active');
};

window.closeCancelModal = function () {
    pendingCancelId = null;
    document.getElementById('cancelModal').classList.remove('active');
};

window.executeCancellation = async function () {
    if (!pendingCancelId) return;

    const btn = document.getElementById('confirmCancelBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling...';

    try {
        const res = await window.api.patch(`/bookings/${pendingCancelId}`, { status: 'cancelled' });
        btn.disabled = false;
        btn.innerHTML = 'Cancel Appointment';
        closeCancelModal();

        if (res.success) {
            window.showToast('Appointment cancelled successfully.', 'success');
            // Update local state
            const target = myBookings.find(b => b.id === pendingCancelId);
            if (target) target.status = 'cancelled';
            renderBookings();
        } else {
            window.showToast(res.message || 'Unable to cancel appointment.', 'error');
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = 'Cancel Appointment';
        window.showToast('Unable to cancel appointment. Please try again.', 'error');
    }
};
