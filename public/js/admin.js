/**
 * Yankiii Barber Co. — Admin Management Engine
 * Provides dashboard KPIs, booking moderation, service CRUD, barber roster & schedules,
 * customer directory, and shop business hours editor.
 */

function adminEscape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

// Shared helper: treat status as "active" consistently whether it's stored
// as the string 'active' or the legacy numeric 1.
function isActiveStatus(status) {
    return status === 'active' || status === 1;
}

function isSafeAdminImageReference(value) {
    if (!value) return true;
    if (/^https:\/\//i.test(value)) return true;
    return /^(?:\/)?assets\/(?:images|logo)\/[a-z0-9._-]+\.(?:avif|gif|jpe?g|png|webp|svg)$/i.test(value) && !value.includes('..');
}

function updateAdminImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    const value = input.value.trim();
    if (!value || !isSafeAdminImageReference(value)) {
        preview.removeAttribute('src');
        preview.hidden = true;
        return;
    }
    preview.src = /^https:\/\//i.test(value)
        ? value
        : `/${value.replace(/^\/+/, '')}`;
    preview.hidden = false;
}

window.selectBarberPreset = function (presetPath) {
    const input = document.getElementById('barberImage');
    if (input) {
        input.value = presetPath;
        updateAdminImagePreview('barberImage', 'barberImagePreview');
    }
};

window.selectServicePreset = function (presetPath) {
    const input = document.getElementById('serviceImage');
    if (input) {
        input.value = presetPath;
        updateAdminImagePreview('serviceImage', 'serviceImagePreview');
    }
};

// Shared helper: turn a "HH:MM" (24h) string into a "H:MM AM/PM" display string.
function formatTime12h(timeStr) {
    const [hStr, mStr] = (timeStr || '00:00').split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
}

// Verify Admin Session on load
function verifyAdminSession() {
    const token = window.api ? window.api.getToken() : null;
    const user = window.api ? window.api.getUser() : null;

    if (!token || !user) {
        window.location.href = '../login.html';
        return false;
    }

    if (user.role !== 'admin') {
        alert('Access Restricted: Admin privileges required.');
        window.location.href = '../dashboard.html';
        return false;
    }

    const nameEl = document.getElementById('adminUserDisplayName');
    if (nameEl && user.name) {
        nameEl.textContent = user.name;
    }

    return true;
}

// Global Mobile Sidebar Toggle
window.toggleSidebar = function () {
    const sidebar = document.getElementById('adminSidebar');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    if (sidebar) {
        const isOpen = sidebar.classList.toggle('open');
        if (closeBtn) closeBtn.style.display = isOpen ? 'block' : 'none';
    }
};

window.logoutAdmin = function () {
    localStorage.removeItem('ybc_token');
    localStorage.removeItem('ybc_user');
    window.location.href = '../login.html';
};

// ==========================================
// 1. DASHBOARD OVERVIEW PAGE
// ==========================================
async function initDashboardPage() {
    if (!verifyAdminSession()) return;

    try {
        const res = await window.api.get('/admin/dashboard');
        if (res.success && res.data) {
            renderDashboardData(res.data);
            return;
        }
    } catch (e) {
        console.error('Failed to load dashboard data:', e);
    }

    renderDashboardData({ stats: {}, recent_bookings: [] });
    window.showToast('We couldn’t load dashboard data. Please refresh.', 'error');
}
window.initDashboardPage = initDashboardPage;

function renderDashboardData(data) {
    const s = data.stats || {};
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setTxt('kpiTotalBookings', s.total_bookings ?? 0);
    setTxt('kpiTodayBookings', s.today_bookings ?? 0);
    setTxt('kpiPendingBookings', s.pending_bookings ?? 0);
    setTxt('kpiCompletedBookings', s.completed_bookings ?? 0);
    setTxt('kpiTotalCustomers', s.total_customers ?? 0);
    setTxt('kpiTotalRevenue', `₱${Number(s.total_revenue ?? 0).toLocaleString()}`);

    const tbody = document.getElementById('recentBookingsTableBody');
    if (!tbody) return;

    const list = data.recent_bookings || [];
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#65705f;">No bookings recorded yet.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(b => {
        const timeFormatted = formatTime12h(b.start_time);
        const status = adminEscape(b.status);
        const statusClass = adminEscape(String(b.status || '').toLowerCase());

        return `
            <tr>
                <td><strong style="font-family:monospace; color:var(--primary);">${adminEscape(b.booking_reference)}</strong></td>
                <td><strong>${adminEscape(b.customer_name)}</strong></td>
                <td>${adminEscape(b.service_name)}</td>
                <td>${adminEscape(b.barber_name)}</td>
                <td>${adminEscape(b.booking_date)} @ ${timeFormatted}</td>
                <td><strong>₱${Number(b.total_price).toLocaleString()}</strong></td>
                <td><span class="badge badge-${statusClass}">${status}</span></td>
                <td>
                    <div class="action-btns-group">
                        <button type="button" class="btn-icon-action" title="Confirm" onclick="updateBookingStatus(${b.id}, 'confirmed')"><i class="fa-solid fa-check"></i></button>
                        <button type="button" class="btn-icon-action" title="Complete" onclick="updateBookingStatus(${b.id}, 'completed')"><i class="fa-solid fa-circle-check"></i></button>
                        <button type="button" class="btn-icon-action danger" title="Cancel" onclick="updateBookingStatus(${b.id}, 'cancelled')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Auto-init the dashboard page only when its markup is actually present,
// rather than sniffing the URL path (which breaks under subpaths, clean
// URLs, or a renamed file). Safe to leave in place even if the page also
// calls window.initDashboardPage() explicitly — this only fires once.
if (document.getElementById('recentBookingsTableBody')) {
    document.addEventListener('DOMContentLoaded', initDashboardPage);
}

// ==========================================
// 2. BOOKINGS MANAGEMENT PAGE
// ==========================================
let allAdminBookings = [];
let pendingCancelBookingId = null;

// Helper: Format date string YYYY-MM-DD into a human-friendly format (e.g., "Mon, Oct 5, 2026")
function formatDateDisplay(dateStr) {
    if (!dateStr) return '—';
    try {
        const parts = String(dateStr).split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            }
        }
    } catch (_) {}
    return String(dateStr);
}

window.initBookingsPage = async function () {
    if (!verifyAdminSession()) return;
    await loadAdminBookings();
};

async function loadAdminBookings() {
    try {
        const res = await window.api.get('/bookings');
        if (res.success && Array.isArray(res.data)) {
            allAdminBookings = res.data;
            populateBarberFilterOptions();
            updateBookingKpis();
            filterBookingsTable();
            return;
        }
    } catch (e) {
        console.error('Failed to load bookings:', e);
    }

    allAdminBookings = [];
    window.showToast('We couldn’t load bookings. Please refresh.', 'error');
    updateBookingKpis();
    renderAdminBookings(allAdminBookings);
}

function updateBookingKpis() {
    const counts = {
        all: allAdminBookings.length,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0
    };

    allAdminBookings.forEach(b => {
        const st = String(b.status || '').toLowerCase();
        if (counts[st] !== undefined) counts[st]++;
    });

    const setBadge = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
    };

    setBadge('kpiCountAll', counts.all);
    setBadge('kpiCountPending', counts.pending);
    setBadge('kpiCountConfirmed', counts.confirmed);
    setBadge('kpiCountCompleted', counts.completed);
    setBadge('kpiCountCancelled', counts.cancelled);

    const badge = document.getElementById('bookingCountBadge');
    if (badge) {
        badge.innerHTML = `<i class="fa-regular fa-calendar-check"></i> <span>${counts.all} Appointments</span>`;
    }
}

function populateBarberFilterOptions() {
    const select = document.getElementById('bookingBarberFilter');
    if (!select) return;

    const currentVal = select.value;
    const barbersMap = new Map();

    allAdminBookings.forEach(b => {
        if (b.barber_name) {
            barbersMap.set(b.barber_name, b.barber_name);
        }
    });

    let html = '<option value="all">All Barbers</option>';
    barbersMap.forEach((name) => {
        html += `<option value="${adminEscape(name)}">${adminEscape(name)}</option>`;
    });

    select.innerHTML = html;
    if (currentVal && barbersMap.has(currentVal)) {
        select.value = currentVal;
    }
}

window.selectBookingStatusTab = function (status) {
    const tabs = document.querySelectorAll('.booking-kpi-tab');
    tabs.forEach(t => {
        const isMatch = t.getAttribute('data-status') === status;
        t.classList.toggle('active', isMatch);
        t.setAttribute('aria-selected', String(isMatch));
    });

    const hiddenStatus = document.getElementById('bookingStatusFilter');
    if (hiddenStatus) hiddenStatus.value = status;

    filterBookingsTable();
};

window.onBookingDatePresetChange = function () {
    const preset = document.getElementById('bookingDatePreset').value;
    const customWrap = document.getElementById('bookingCustomDateWrap');
    if (customWrap) {
        customWrap.style.display = preset === 'custom' ? 'flex' : 'none';
    }
    filterBookingsTable();
};

window.filterBookingsTable = function () {
    const search = (document.getElementById('bookingSearchInput')?.value || '').toLowerCase().trim();
    const status = document.getElementById('bookingStatusFilter')?.value || 'all';
    const barber = document.getElementById('bookingBarberFilter')?.value || 'all';
    const datePreset = document.getElementById('bookingDatePreset')?.value || 'all';
    const customDate = document.getElementById('bookingDateInput')?.value || '';

    const todayObj = new Date();
    const todayStr = todayObj.toISOString().slice(0, 10);

    const tomorrowObj = new Date();
    tomorrowObj.setDate(todayObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);

    const weekEndObj = new Date();
    weekEndObj.setDate(todayObj.getDate() + 7);
    const weekEndStr = weekEndObj.toISOString().slice(0, 10);

    const filtered = allAdminBookings.filter(b => {
        // Search match
        const matchesSearch = !search ||
            (b.booking_reference || '').toLowerCase().includes(search) ||
            (b.customer_name || '').toLowerCase().includes(search) ||
            (b.customer_phone || '').toLowerCase().includes(search) ||
            (b.customer_email || '').toLowerCase().includes(search) ||
            (b.barber_name || '').toLowerCase().includes(search) ||
            (b.service_name || '').toLowerCase().includes(search);

        // Status match
        const bStatus = (b.status || '').toLowerCase();
        const matchesStatus = (status === 'all') || (bStatus === status);

        // Barber match
        const matchesBarber = (barber === 'all') || (b.barber_name === barber);

        // Date match
        let matchesDate = true;
        const bDate = b.booking_date ? String(b.booking_date).slice(0, 10) : '';

        if (datePreset === 'today') {
            matchesDate = (bDate === todayStr);
        } else if (datePreset === 'tomorrow') {
            matchesDate = (bDate === tomorrowStr);
        } else if (datePreset === 'this_week') {
            matchesDate = (bDate >= todayStr && bDate <= weekEndStr);
        } else if (datePreset === 'custom' && customDate) {
            matchesDate = (bDate === customDate);
        }

        return matchesSearch && matchesStatus && matchesBarber && matchesDate;
    });

    // Update filter summary text
    const summaryEl = document.getElementById('bookingFilterSummary');
    if (summaryEl) {
        summaryEl.textContent = `Showing ${filtered.length} of ${allAdminBookings.length} appointments.`;
    }

    renderAdminBookings(filtered);
};

window.clearBookingFilters = function () {
    const search = document.getElementById('bookingSearchInput');
    const barber = document.getElementById('bookingBarberFilter');
    const datePreset = document.getElementById('bookingDatePreset');
    const customDate = document.getElementById('bookingDateInput');
    const customWrap = document.getElementById('bookingCustomDateWrap');

    if (search) search.value = '';
    if (barber) barber.value = 'all';
    if (datePreset) datePreset.value = 'all';
    if (customDate) customDate.value = '';
    if (customWrap) customWrap.style.display = 'none';

    window.selectBookingStatusTab('all');
};

function renderAdminBookings(list) {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="booking-empty-state">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <h4>No matching appointments found</h4>
                    <p>Try adjusting your search terms, date range, or status filters.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(b => {
        const timeFormatted = formatTime12h(b.start_time);
        const dateFormatted = formatDateDisplay(b.booking_date);
        const status = adminEscape(b.status);
        const statusLower = String(b.status || '').toLowerCase();
        const statusClass = adminEscape(statusLower);

        // Contextual action buttons based on current booking status
        let actionButtonsHtml = '';
        if (statusLower === 'pending') {
            actionButtonsHtml = `
                <button type="button" class="booking-action-btn btn-confirm" title="Confirm Appointment" onclick="updateBookingStatus(${b.id}, 'confirmed')">
                    <i class="fa-solid fa-check"></i> Confirm
                </button>
                <button type="button" class="booking-action-btn btn-cancel" title="Cancel Appointment" onclick="confirmCancelBooking(${b.id})">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
        } else if (statusLower === 'confirmed') {
            actionButtonsHtml = `
                <button type="button" class="booking-action-btn btn-complete" title="Mark as Completed" onclick="updateBookingStatus(${b.id}, 'completed')">
                    <i class="fa-solid fa-circle-check"></i> Complete
                </button>
                <button type="button" class="booking-action-btn btn-cancel" title="Cancel Appointment" onclick="confirmCancelBooking(${b.id})">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
        } else if (statusLower === 'completed') {
            actionButtonsHtml = `
                <span style="font-size:12px; color:#2e6930; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                    <i class="fa-solid fa-circle-check"></i> Completed
                </span>
            `;
        } else if (statusLower === 'cancelled') {
            actionButtonsHtml = `
                <button type="button" class="booking-action-btn btn-confirm" title="Reactivate Booking" onclick="updateBookingStatus(${b.id}, 'confirmed')">
                    <i class="fa-solid fa-rotate-left"></i> Reopen
                </button>
            `;
        }

        const customerPhone = b.customer_phone ? adminEscape(b.customer_phone) : '';
        const phoneLink = customerPhone ? `<a href="tel:${customerPhone}" style="color:#65705f; font-size:12px; text-decoration:none;"><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${customerPhone}</a>` : '';

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center;">
                        <strong style="font-family:monospace; color:var(--primary); font-size:13px;">${adminEscape(b.booking_reference)}</strong>
                        <button type="button" class="copy-ref-btn" title="Copy Reference Code" onclick="copyReference('${adminEscape(b.booking_reference)}', this)">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <strong style="color:var(--dark);">${adminEscape(b.customer_name)}</strong>
                    <div>${phoneLink}</div>
                </td>
                <td>
                    <strong>${adminEscape(b.service_name)}</strong>
                    <div style="font-size:12px; color:#65705f;"><i class="fa-regular fa-clock"></i> ${Number(b.duration) || 30} mins</div>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-scissors" style="color:var(--secondary); font-size:11px;"></i>
                        <span>${adminEscape(b.barber_name)}</span>
                    </div>
                </td>
                <td>${dateFormatted}</td>
                <td><strong>${timeFormatted}</strong></td>
                <td><strong style="color:var(--dark);">₱${Number(b.total_price).toLocaleString()}</strong></td>
                <td><span class="badge badge-${statusClass}">${status}</span></td>
                <td>
                    <div class="booking-actions-cell">
                        ${actionButtonsHtml}
                        <button type="button" class="booking-action-btn btn-view" title="View Full Details" onclick="viewBookingDetails(${b.id})">
                            <i class="fa-solid fa-eye"></i> Details
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.copyReference = async function (ref, btn) {
    if (!ref) return;
    try {
        await navigator.clipboard.writeText(ref);
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = 'fa-solid fa-check';
            icon.style.color = '#16a34a';
            setTimeout(() => {
                icon.className = 'fa-regular fa-copy';
                icon.style.color = '';
            }, 1500);
        }
    } catch (_) {}
};

window.confirmCancelBooking = function (id) {
    const b = allAdminBookings.find(x => x.id === id);
    if (!b) return;

    pendingCancelBookingId = id;
    const textEl = document.getElementById('cancelConfirmText');
    if (textEl) {
        textEl.innerHTML = `Are you sure you want to cancel appointment <strong>${adminEscape(b.booking_reference)}</strong> for <strong>${adminEscape(b.customer_name)}</strong>?`;
    }

    const modal = document.getElementById('cancelBookingConfirmModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    const proceedBtn = document.getElementById('confirmCancelProceedBtn');
    if (proceedBtn) {
        proceedBtn.onclick = async function () {
            closeCancelConfirmModal();
            await updateBookingStatus(id, 'cancelled');
        };
    }
};

window.closeCancelConfirmModal = function () {
    const modal = document.getElementById('cancelBookingConfirmModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    pendingCancelBookingId = null;
};

window.updateBookingStatus = async function (id, newStatus) {
    let updated = false;
    try {
        const res = await window.api.patch(`/bookings/${id}`, { status: newStatus });
        if (res && res.success) {
            updated = true;
            window.showToast(`Booking marked as ${newStatus}.`, 'success');
        } else {
            window.showToast((res && res.message) || 'Unable to update booking status.', 'error');
        }
    } catch (e) {
        console.error('Failed to update booking status:', e);
        window.showToast('Unable to update booking status. Please try again.', 'error');
    }

    if (updated) {
        const item = allAdminBookings.find(b => b.id === id);
        if (item) item.status = newStatus;
        updateBookingKpis();
        filterBookingsTable();

        // If details modal is open for this booking, re-render it
        const detailsModal = document.getElementById('bookingDetailsModal');
        if (detailsModal && detailsModal.classList.contains('active')) {
            viewBookingDetails(id);
        }
    }
};

window.viewBookingDetails = function (id) {
    const b = allAdminBookings.find(x => x.id === id);
    if (!b) return;

    const modalBody = document.getElementById('bookingDetailsBody');
    if (!modalBody) return;

    const timeFormatted = formatTime12h(b.start_time);
    const dateFormatted = formatDateDisplay(b.booking_date);
    const statusClass = adminEscape(String(b.status || '').toLowerCase());
    const status = adminEscape(b.status);

    modalBody.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid #edf2ed; flex-wrap:wrap; gap:10px;">
            <div>
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#788273;">REFERENCE CODE</span>
                <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
                    <strong style="font-family:monospace; font-size:16px; color:var(--primary);">${adminEscape(b.booking_reference)}</strong>
                    <button type="button" class="copy-ref-btn" title="Copy Reference" onclick="copyReference('${adminEscape(b.booking_reference)}', this)">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                </div>
            </div>
            <span class="badge badge-${statusClass}" style="font-size:13px; padding:6px 14px;">${status}</span>
        </div>

        <div class="booking-modal-summary">
            <!-- Customer Box -->
            <div class="booking-modal-card">
                <div class="booking-modal-card-title">
                    <i class="fa-solid fa-user"></i> Customer Information
                </div>
                <div class="booking-modal-row">
                    <span>Full Name</span>
                    <strong>${adminEscape(b.customer_name)}</strong>
                </div>
                <div class="booking-modal-row">
                    <span>Phone</span>
                    <strong>
                        ${b.customer_phone ? `<a href="tel:${adminEscape(b.customer_phone)}" style="color:var(--primary); text-decoration:none;"><i class="fa-solid fa-phone" style="font-size:11px;"></i> ${adminEscape(b.customer_phone)}</a>` : '—'}
                    </strong>
                </div>
                <div class="booking-modal-row">
                    <span>Email</span>
                    <strong>
                        ${b.customer_email ? `<a href="mailto:${adminEscape(b.customer_email)}" style="color:var(--primary); text-decoration:none;"><i class="fa-solid fa-envelope" style="font-size:11px;"></i> ${adminEscape(b.customer_email)}</a>` : '—'}
                    </strong>
                </div>
                <div class="booking-modal-row">
                    <span>Payment</span>
                    <strong>${adminEscape(b.payment_method || 'Pay at Shop')}</strong>
                </div>
            </div>

            <!-- Appointment Box -->
            <div class="booking-modal-card">
                <div class="booking-modal-card-title">
                    <i class="fa-solid fa-scissors"></i> Service & Barber
                </div>
                <div class="booking-modal-row">
                    <span>Service</span>
                    <strong>${adminEscape(b.service_name)}</strong>
                </div>
                <div class="booking-modal-row">
                    <span>Barber</span>
                    <strong>${adminEscape(b.barber_name)}</strong>
                </div>
                <div class="booking-modal-row">
                    <span>Date</span>
                    <strong>${dateFormatted}</strong>
                </div>
                <div class="booking-modal-row">
                    <span>Time & Duration</span>
                    <strong>${timeFormatted} (${Number(b.duration) || 30} mins)</strong>
                </div>
                <div class="booking-modal-row">
                    <span>Total Price</span>
                    <strong style="color:var(--primary); font-size:15px;">₱${Number(b.total_price).toLocaleString()}</strong>
                </div>
            </div>
        </div>

        <!-- Notes Box -->
        <div class="booking-modal-notes">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#727e6e;">
                <i class="fa-regular fa-message"></i> Special Instructions & Notes
            </div>
            <p>${adminEscape(b.notes || 'No special requests or instructions provided by customer.')}</p>
        </div>

        <!-- Modal Status Actions Bar -->
        <div class="booking-modal-actions-bar">
            <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:#65705f;">Quick Status Action:</span>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${b.status !== 'confirmed' ? `
                    <button type="button" class="btn btn-sm btn-outline" style="border-color:#A7C99B; color:#2e5923;" onclick="updateBookingStatus(${b.id}, 'confirmed')">
                        <i class="fa-solid fa-check"></i> Mark Confirmed
                    </button>
                ` : ''}
                ${b.status !== 'completed' ? `
                    <button type="button" class="btn btn-sm btn-primary" onclick="updateBookingStatus(${b.id}, 'completed')">
                        <i class="fa-solid fa-circle-check"></i> Mark Completed
                    </button>
                ` : ''}
                ${b.status !== 'cancelled' ? `
                    <button type="button" class="btn btn-sm btn-ghost" style="color:#dc2626;" onclick="confirmCancelBooking(${b.id})">
                        <i class="fa-solid fa-xmark"></i> Cancel Booking
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    const modal = document.getElementById('bookingDetailsModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
};

window.closeDetailsModal = function () {
    const modal = document.getElementById('bookingDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
};

// ==========================================
// 3. SERVICES MANAGEMENT PAGE
// ==========================================
let allAdminServices = [];

window.initServicesPage = async function () {
    if (!verifyAdminSession()) return;
    await loadAdminServices();
};

async function loadAdminServices() {
    try {
        const res = await window.api.get('/services/admin/all');
        if (res.success && Array.isArray(res.data)) {
            allAdminServices = res.data;
            renderAdminServices(allAdminServices);
            return;
        }
    } catch (e) {
        console.error('Failed to load services:', e);
    }

    allAdminServices = [];
    window.showToast('We couldn’t load services. Please refresh.', 'error');
    renderAdminServices(allAdminServices);
}

function renderAdminServices(list) {
    const tbody = document.getElementById('servicesTableBody');
    if (!tbody) return;

    tbody.innerHTML = list.map(s => {
        const active = isActiveStatus(s.status);
        return `
        <tr>
            <td><strong>#${s.id}</strong></td>
            <td><strong>${adminEscape(s.name)}</strong></td>
            <td><strong>₱${Number(s.price).toLocaleString()}</strong></td>
            <td>${s.duration} mins</td>
            <td style="max-width:280px; font-size:13px; color:#5d6859;">${adminEscape(s.description || '—')}</td>
            <td>
                <span class="badge badge-${active ? 'active' : 'inactive'}">
                    ${active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-btns-group">
                    <button type="button" class="btn-icon-action" title="Edit Service" onclick="openEditServiceModal(${s.id})"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="btn-icon-action danger" title="Toggle Status" onclick="toggleServiceStatus(${s.id})"><i class="fa-solid fa-power-off"></i></button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

window.openAddServiceModal = function () {
    const modal = document.getElementById('serviceModal');
    if (!modal) return;
    document.getElementById('serviceModalTitle').textContent = 'Add Service';
    document.getElementById('serviceFormId').value = '';
    document.getElementById('serviceName').value = '';
    document.getElementById('servicePrice').value = '';
    document.getElementById('serviceDuration').value = '30';
    document.getElementById('serviceDesc').value = '';
    document.getElementById('serviceImage').value = '';
    updateAdminImagePreview('serviceImage', 'serviceImagePreview');
    document.getElementById('serviceStatus').value = 'active';
    modal.classList.add('active');
};

window.openEditServiceModal = function (id) {
    const s = allAdminServices.find(x => x.id === id);
    const modal = document.getElementById('serviceModal');
    if (!s || !modal) return;

    document.getElementById('serviceModalTitle').textContent = 'Edit Service';
    document.getElementById('serviceFormId').value = s.id;
    document.getElementById('serviceName').value = s.name;
    document.getElementById('servicePrice').value = s.price;
    document.getElementById('serviceDuration').value = s.duration;
    document.getElementById('serviceDesc').value = s.description || '';
    document.getElementById('serviceImage').value = s.image || '';
    updateAdminImagePreview('serviceImage', 'serviceImagePreview');
    document.getElementById('serviceStatus').value = isActiveStatus(s.status) ? 'active' : 'inactive';
    modal.classList.add('active');
};

window.closeServiceModal = function () {
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.remove('active');
};

window.handleSaveService = async function (e) {
    e.preventDefault();
    const id = document.getElementById('serviceFormId').value;
    const name = document.getElementById('serviceName').value.trim();
    const price = Number(document.getElementById('servicePrice').value);
    const duration = Number(document.getElementById('serviceDuration').value);
    const description = document.getElementById('serviceDesc').value.trim();
    const image = document.getElementById('serviceImage').value.trim();
    const status = document.getElementById('serviceStatus').value;

    const payload = { name, price, duration, description, image, status };

    if (image && !isSafeAdminImageReference(image)) {
        window.showToast('Use an image under /assets/images or a secure https image URL.', 'error');
        return;
    }

    let saved = false;
    try {
        let response;
        if (id) {
            response = await window.api.put(`/services/${id}`, payload);
        } else {
            response = await window.api.post('/services', payload);
        }
        if (!response.success) throw new Error(response.message || 'Unable to save service.');
        saved = true;
        window.showToast(id ? 'Service updated successfully.' : 'New service added successfully.', 'success');
    } catch (err) {
        console.error('Failed to save service:', err);
        window.showToast('Unable to save service. Please try again.', 'error');
    }

    // Only close and refresh on a confirmed save — on failure, keep the
    // modal open (with the user's input intact) so they can retry.
    if (saved) {
        closeServiceModal();
        await loadAdminServices();
    }
};

window.toggleServiceStatus = async function (id) {
    const s = allAdminServices.find(x => x.id === id);
    if (!s) return;

    const newStatus = isActiveStatus(s.status) ? 'inactive' : 'active';
    try {
        const response = await window.api.put(`/services/${id}`, { ...s, status: newStatus });
        if (!response.success) throw new Error(response.message || 'Unable to update service status.');
    } catch (e) {
        console.error('Failed to toggle service status:', e);
        window.showToast('Unable to update service status. Please try again.', 'error');
        return; // don't touch local state or re-render — nothing actually changed
    }

    window.showToast(`Service marked as ${newStatus}.`, 'success');
    s.status = newStatus;
    renderAdminServices(allAdminServices);
};

// ==========================================
// 4. BARBERS MANAGEMENT PAGE
// ==========================================
let allAdminBarbers = [];

window.initBarbersPage = async function () {
    if (!verifyAdminSession()) return;
    await loadAdminBarbers();
};

async function loadAdminBarbers() {
    try {
        const res = await window.api.get('/barbers/admin/all');
        if (res.success && Array.isArray(res.data)) {
            allAdminBarbers = res.data;
            renderAdminBarbers(allAdminBarbers);
            return;
        }
    } catch (e) {
        console.error('Failed to load barbers:', e);
    }

    allAdminBarbers = [];
    window.showToast('We couldn’t load barbers. Please refresh.', 'error');
    renderAdminBarbers(allAdminBarbers);
}

function renderAdminBarbers(list) {
    const tbody = document.getElementById('barbersTableBody');
    if (!tbody) return;

    tbody.innerHTML = list.map(b => {
        const active = isActiveStatus(b.status);
        return `
        <tr>
            <td>
                <strong>${adminEscape(b.name)}</strong>
            </td>
            <td><strong>${adminEscape(b.specialty)}</strong></td>
            <td style="max-width:320px; font-size:13px; color:#5d6859;">${adminEscape(b.bio || '—')}</td>
            <td>
                <span class="badge badge-${active ? 'active' : 'inactive'}">
                    ${active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-btns-group">
                    <button type="button" class="btn-icon-action" title="Edit Barber" onclick="openEditBarberModal(${b.id})"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="btn-icon-action" title="Manage Schedule" onclick="openScheduleModal(${Number(b.id)})"><i class="fa-solid fa-calendar-days"></i></button>
                    <button type="button" class="btn-icon-action danger" title="Toggle Active" onclick="toggleBarberStatus(${b.id})"><i class="fa-solid fa-power-off"></i></button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
}

window.openAddBarberModal = function () {
    const modal = document.getElementById('barberModal');
    if (!modal) return;
    document.getElementById('barberModalTitle').textContent = 'Add Barber';
    document.getElementById('barberFormId').value = '';
    document.getElementById('barberName').value = '';
    document.getElementById('barberSpecialty').value = '';
    document.getElementById('barberBio').value = '';
    document.getElementById('barberImage').value = '';
    updateAdminImagePreview('barberImage', 'barberImagePreview');
    document.getElementById('barberStatus').value = 'active';
    modal.classList.add('active');
};

window.openEditBarberModal = function (id) {

    const barber =
        allAdminBarbers.find(
            barber => Number(barber.id) === Number(id)
        );

    const modal =
        document.getElementById('barberModal');

    if (!barber || !modal) {
        return;
    }


    document.getElementById(
        'barberModalTitle'
    ).textContent = 'Edit Barber';


    document.getElementById(
        'barberFormId'
    ).value = barber.id;


    document.getElementById(
        'barberName'
    ).value = barber.name || '';


    document.getElementById(
        'barberSpecialty'
    ).value = barber.specialty || '';


    document.getElementById(
        'barberBio'
    ).value = barber.bio || '';


    /*
     * THIS LOADS THE CURRENT PHOTO
     */

    document.getElementById(
        'barberImage'
    ).value = barber.image || '';
    updateAdminImagePreview('barberImage', 'barberImagePreview');


    document.getElementById(
        'barberStatus'
    ).value =
        isActiveStatus(barber.status)
            ? 'active'
            : 'inactive';


    modal.classList.add('active');

};

window.closeBarberModal = function () {
    const modal = document.getElementById('barberModal');
    if (modal) modal.classList.remove('active');
};

window.handleSaveBarber = async function (e) {

    e.preventDefault();


    const id =
        document.getElementById(
            'barberFormId'
        ).value;


    const name =
        document.getElementById(
            'barberName'
        ).value.trim();


    const specialty =
        document.getElementById(
            'barberSpecialty'
        ).value.trim();


    const bio =
        document.getElementById(
            'barberBio'
        ).value.trim();


    const image =
        document.getElementById(
            'barberImage'
        ).value.trim();

    if (image && !isSafeAdminImageReference(image)) {
        window.showToast('Use an image under /assets/images or a secure https image URL.', 'error');
        return;
    }


    const status =
        document.getElementById(
            'barberStatus'
        ).value;


    if (!name) {

        window.showToast(
            'Barber name is required.',
            'error'
        );

        return;
    }


    if (!specialty) {

        window.showToast(
            'Barber specialty is required.',
            'error'
        );

        return;
    }


    const payload = {

        name,
        specialty,
        bio,
        image,
        status

    };


    try {

        let response;


        if (id) {

            response =
                await window.api.put(
                    `/barbers/${id}`,
                    payload
                );

        } else {

            response =
                await window.api.post(
                    '/barbers',
                    payload
                );

        }


        if (!response.success) {

            throw new Error(
                response.message ||
                'Unable to save barber.'
            );

        }


        window.showToast(

            id
                ? 'Barber profile updated successfully.'
                : 'New barber added successfully.',

            'success'

        );


        closeBarberModal();


        /*
         * Reload data from database.
         */

        await loadAdminBarbers();


    } catch (error) {

        console.error(
            'Failed to save barber:',
            error
        );


        window.showToast(

            error.message ||
            'Unable to save barber. Please try again.',

            'error'

        );

    }

};

window.toggleBarberStatus = async function (id) {
    const b = allAdminBarbers.find(x => x.id === id);
    if (!b) return;

    const newStatus = isActiveStatus(b.status) ? 'inactive' : 'active';
    try {
        const response = await window.api.put(`/barbers/${id}`, { ...b, status: newStatus });
        if (!response.success) throw new Error(response.message || 'Unable to update barber status.');
    } catch (e) {
        console.error('Failed to toggle barber status:', e);
        window.showToast('Unable to update barber status. Please try again.', 'error');
        return;
    }

    window.showToast(`Barber marked as ${newStatus}.`, 'success');
    b.status = newStatus;
    renderAdminBarbers(allAdminBarbers);
};

// Barber Schedule Modal
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

window.openScheduleModal = async function (barberId) {
    const modal = document.getElementById('scheduleModal');
    const container = document.getElementById('scheduleDaysContainer');
    if (!modal || !container) return;

    const selectedBarber = allAdminBarbers.find(barber => Number(barber.id) === Number(barberId));
    document.getElementById('schedBarberId').value = barberId;
    document.getElementById('schedBarberName').textContent = selectedBarber ? selectedBarber.name : 'Barber';

    container.innerHTML = '<p style="text-align:center;padding:20px;">Loading schedule...</p>';
    modal.classList.add('active');

    let scheduleData = [];
    try {
        const res = await window.api.get(`/barbers/${barberId}/schedule`);
        if (res.success && Array.isArray(res.data)) {
            scheduleData = res.data;
        }
    } catch (e) {
        console.error('Failed to load barber schedule:', e);
    }

    if (scheduleData.length === 0) {
        container.innerHTML = '<p class="api-state api-state-error">No schedule is configured for this barber.</p>';
        return;
    }

    container.innerHTML = scheduleData.map(d => {
        const isWorking = d.is_working === 1 || d.is_working === true;
        const dayName = DAY_NAMES[d.day_of_week];
        return `
            <div class="schedule-day-row">
                <strong>${dayName}</strong>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" name="work_${d.day_of_week}" ${isWorking ? 'checked' : ''} onchange="toggleScheduleRow(this, ${d.day_of_week})">
                    <span>Working</span>
                </label>
                <div>
                    <label style="font-size:11px;color:#65705f;">Start Time</label>
                    <input type="time" name="start_${d.day_of_week}" value="${d.start_time ? d.start_time.slice(0,5) : '09:00'}" class="form-control" style="padding:6px 10px;" ${isWorking ? '' : 'disabled'}>
                </div>
                <div>
                    <label style="font-size:11px;color:#65705f;">End Time</label>
                    <input type="time" name="end_${d.day_of_week}" value="${d.end_time ? d.end_time.slice(0,5) : '18:00'}" class="form-control" style="padding:6px 10px;" ${isWorking ? '' : 'disabled'}>
                </div>
            </div>
        `;
    }).join('');
};

window.toggleScheduleRow = function (checkbox, dayIndex) {
    const startInput = document.querySelector(`input[name="start_${dayIndex}"]`);
    const endInput = document.querySelector(`input[name="end_${dayIndex}"]`);
    if (startInput) startInput.disabled = !checkbox.checked;
    if (endInput) endInput.disabled = !checkbox.checked;
};

window.closeScheduleModal = function () {
    const modal = document.getElementById('scheduleModal');
    if (modal) modal.classList.remove('active');
};

window.handleSaveSchedule = async function (e) {
    e.preventDefault();
    const barberId = document.getElementById('schedBarberId').value;
    const schedule = [];

    for (let i = 0; i < 7; i++) {
        const isWorking = document.querySelector(`input[name="work_${i}"]`)?.checked || false;
        const start = document.querySelector(`input[name="start_${i}"]`)?.value || '09:00';
        const end = document.querySelector(`input[name="end_${i}"]`)?.value || '18:00';
        schedule.push({ day_of_week: i, is_working: isWorking ? 1 : 0, start_time: start, end_time: end });
    }

    let saved = false;
    try {
        const response = await window.api.put(`/barbers/${barberId}/schedule`, { schedule });
        if (!response.success) throw new Error(response.message || 'Unable to update barber schedule.');
        saved = true;
        window.showToast('Barber schedule updated.', 'success');
    } catch (err) {
        console.error('Failed to save barber schedule:', err);
        window.showToast('Unable to update the schedule. Please try again.', 'error');
    }

    if (saved) {
        closeScheduleModal();
    }
};

// ==========================================
// 5. CUSTOMERS DIRECTORY PAGE
// ==========================================
let allCustomers = [];

window.initCustomersPage = async function () {
    if (!verifyAdminSession()) return;
    await loadCustomers();
};

async function loadCustomers() {
    try {
        const res = await window.api.get('/admin/customers');
        if (res.success && Array.isArray(res.data)) {
            allCustomers = res.data;
            renderCustomers(allCustomers);
            return;
        }
    } catch (e) {
        console.error('Failed to load customers:', e);
    }

    allCustomers = [];
    window.showToast('We couldn’t load customers. Please refresh.', 'error');
    renderCustomers(allCustomers);
}

function renderCustomers(list) {
    const tbody = document.getElementById('customersTableBody');
    const badge = document.getElementById('customerCountBadge');
    if (badge) badge.textContent = `${list.length} Clients`;
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#65705f;">No customers found.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(c => `
        <tr>
            <td><strong>${adminEscape(c.name)}</strong></td>
            <td>${adminEscape(c.email)}</td>
            <td>${adminEscape(c.phone || '—')}</td>
            <td><span class="badge ${c.role === 'admin' ? 'badge-confirmed' : 'badge-pending'}">${adminEscape(c.role)}</span></td>
            <td><strong>${c.total_bookings || 0}</strong> cuts</td>
            <td style="font-size:13px;color:#65705f;">${c.created_at ? adminEscape(c.created_at.slice(0, 10)) : '—'}</td>
        </tr>
    `).join('');
}

window.filterCustomersTable = function () {
    const q = (document.getElementById('customerSearchInput').value || '').toLowerCase();
    const filtered = allCustomers.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
    );
    renderCustomers(filtered);
};

// ==========================================
// 6. BUSINESS HOURS & SETTINGS PAGE
// ==========================================
window.initSettingsPage = async function () {
    if (!verifyAdminSession()) return;
    await loadBusinessHours();
};

async function loadBusinessHours() {
    const container = document.getElementById('businessHoursContainer');
    if (!container) return;

    let hoursData = [];
    try {
        const res = await window.api.get('/admin/settings/hours');
        if (res.success && Array.isArray(res.data)) {
            hoursData = res.data;
        }
    } catch (e) {
        console.error('Failed to load business hours:', e);
    }

    if (hoursData.length === 0) {
        container.innerHTML = '<p class="api-state api-state-error">Business hours have not been configured.</p>';
        return;
    }

    container.innerHTML = hoursData.map(h => {
        const isOpen = h.is_open === 1 || h.is_open === true;
        const dayName = DAY_NAMES[h.day_of_week];
        return `
            <div class="schedule-day-row">
                <strong>${dayName}</strong>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" name="open_${h.day_of_week}" ${isOpen ? 'checked' : ''} onchange="toggleHoursRow(this, ${h.day_of_week})">
                    <span>Shop Open</span>
                </label>
                <div>
                    <label style="font-size:11px;color:#65705f;">Opening Time</label>
                    <input type="time" name="open_time_${h.day_of_week}" value="${h.open_time ? h.open_time.slice(0,5) : '09:00'}" class="form-control" style="padding:6px 10px;" ${isOpen ? '' : 'disabled'}>
                </div>
                <div>
                    <label style="font-size:11px;color:#65705f;">Closing Time</label>
                    <input type="time" name="close_time_${h.day_of_week}" value="${h.close_time ? h.close_time.slice(0,5) : '20:00'}" class="form-control" style="padding:6px 10px;" ${isOpen ? '' : 'disabled'}>
                </div>
            </div>
        `;
    }).join('');
}

window.toggleHoursRow = function (checkbox, dayIndex) {
    const openInput = document.querySelector(`input[name="open_time_${dayIndex}"]`);
    const closeInput = document.querySelector(`input[name="close_time_${dayIndex}"]`);
    if (openInput) openInput.disabled = !checkbox.checked;
    if (closeInput) closeInput.disabled = !checkbox.checked;
};

window.handleSaveBusinessHours = async function (e) {
    e.preventDefault();
    const hours = [];

    for (let i = 0; i < 7; i++) {
        const isOpen = document.querySelector(`input[name="open_${i}"]`)?.checked || false;
        const openTime = document.querySelector(`input[name="open_time_${i}"]`)?.value || '09:00';
        const closeTime = document.querySelector(`input[name="close_time_${i}"]`)?.value || '20:00';
        hours.push({ day_of_week: i, is_open: isOpen ? 1 : 0, open_time: openTime, close_time: closeTime });
    }

    try {
        const response = await window.api.put('/admin/settings/hours', { hours });
        if (!response.success) throw new Error(response.message || 'Unable to update operating hours.');
        window.showToast('Shop operating hours updated successfully.', 'success');
    } catch (err) {
        console.error('Failed to save business hours:', err);
        window.showToast('Unable to update operating hours. Please try again.', 'error');
    }
};
