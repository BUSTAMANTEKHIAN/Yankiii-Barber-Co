/**
 * Yankiii Barber Co. — Booking Wizard Engine
 * Coordinates service/barber selection, dynamic availability calculation,
 * slot selection, logged-in user prefilling, and reservation confirmation.
 */

const bookingState = {
    step: 1,
    service: null,   // { id, name, price, duration }
    barber: null,    // { id, name, specialty }
    date: '',        // YYYY-MM-DD
    time: '',        // HH:mm
    customer: {
        name: '',
        email: '',
        phone: '',
        notes: ''
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initDatePicker();
    await loadServices();
    await loadBarbers();
    checkUrlParams();
    prefillLoggedInUser();
    updateSummary();
});

// Setup date input restrictions and quick date chips
function initDatePicker() {
    const dateInput = document.getElementById('bookingDateInput');
    const chipsContainer = document.getElementById('quickDateChips');
    if (!dateInput) return;

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const minDateStr = formatDate(today);
    dateInput.min = minDateStr;
    dateInput.value = minDateStr;
    bookingState.date = minDateStr;

    // Quick chips: Today, Tomorrow, Day After
    const days = [
        { label: 'Today', date: new Date(today) },
        { label: 'Tomorrow', date: new Date(today.getTime() + 86400000) },
        { label: 'In 2 Days', date: new Date(today.getTime() + 172800000) }
    ];

    if (chipsContainer) {
        chipsContainer.innerHTML = days.map((d, index) => {
            const dateStr = formatDate(d.date);
            const activeClass = index === 0 ? 'active' : '';
            return `
                <button type="button" class="date-chip-btn ${activeClass}" data-date="${dateStr}">
                    ${d.label} (${d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                </button>
            `;
        }).join('');

        chipsContainer.querySelectorAll('.date-chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                chipsContainer.querySelectorAll('.date-chip-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                dateInput.value = btn.dataset.date;
                bookingState.date = btn.dataset.date;
                updateSummary();
                fetchAvailability();
            });
        });
    }

    dateInput.addEventListener('change', () => {
        bookingState.date = dateInput.value;
        if (chipsContainer) {
            chipsContainer.querySelectorAll('.date-chip-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.date === dateInput.value);
            });
        }
        updateSummary();
        fetchAvailability();
    });
}

// Prefill user data if logged in
function prefillLoggedInUser() {
    const user = window.api ? window.api.getUser() : null;
    if (user) {
        const nameField = document.getElementById('custName');
        const emailField = document.getElementById('custEmail');
        const phoneField = document.getElementById('custPhone');
        if (nameField && user.name) nameField.value = user.name;
        if (emailField && user.email) emailField.value = user.email;
        if (phoneField && user.phone) phoneField.value = user.phone;
    }
}

// Check URL query parameters for pre-selected service or barber
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const serviceId = urlParams.get('service_id');
    const barberId = urlParams.get('barber_id');

    if (serviceId) {
        const serviceItem = document.querySelector(`.service-select-item[data-id="${serviceId}"]`);
        if (serviceItem) {
            selectServiceItem(serviceItem);
        }
    }

    if (barberId) {
        const barberItem = document.querySelector(`.barber-select-item[data-id="${barberId}"]`);
        if (barberItem) {
            selectBarberItem(barberItem);
        }
    }
}

// Load dynamic services from backend or attach events to existing markup
async function loadServices() {
    const list = document.getElementById('serviceOptionsList');
    if (!list) return;

    try {
        const res = await window.api.get('/services');
        if (res.success && Array.isArray(res.data)) {
            const active = res.data.filter(s => s.status === 'active' || s.status === 1);
            list.innerHTML = active.length ? active.map(s => `
                    <div class="service-select-item" data-id="${s.id}" data-name="${window.escapeHtml(s.name)}" data-price="${Number(s.price)}" data-duration="${Number(s.duration)}">
                        <div class="service-item-info">
                            <h4>${window.escapeHtml(s.name)}</h4>
                            <p>${window.escapeHtml(s.description || 'Tailored grooming treatment.')}</p>
                        </div>
                        <div class="service-item-meta">
                            <span class="price">₱${Number(s.price).toLocaleString()}</span>
                            <span class="duration"><i class="fa-regular fa-clock"></i> ${s.duration} min</span>
                        </div>
                    </div>
                `).join('') : '<p class="api-state">No services are currently available.</p>';
        } else {
            list.innerHTML = `<p class="api-state api-state-error">${window.escapeHtml(res.message || 'We couldn’t load services. Please refresh.')}</p>`;
        }
    } catch (e) {
        list.innerHTML = '<p class="api-state api-state-error">We couldn’t load services. Please refresh.</p>';
    }

    list.querySelectorAll('.service-select-item').forEach(item => {
        item.addEventListener('click', () => selectServiceItem(item));
    });
}

function selectServiceItem(item) {
    document.querySelectorAll('.service-select-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');

    bookingState.service = {
        id: item.dataset.id,
        name: item.dataset.name,
        price: Number(item.dataset.price),
        duration: Number(item.dataset.duration)
    };

    document.getElementById('step1NextBtn').disabled = false;
    updateSummary();

    // If date and barber are already selected, refresh slots
    if (bookingState.barber && bookingState.date) {
        fetchAvailability();
    }
}

// Load dynamic barbers from backend or attach events to existing markup
async function loadBarbers() {
    const list = document.getElementById('barberOptionsList');
    if (!list) return;

    try {
        const res = await window.api.get('/barbers');
        if (res.success && Array.isArray(res.data)) {
            const active = res.data.filter(b => b.status === 'active' || b.status === 1);
            list.innerHTML = active.length ? active.map(b => {
                    const img = b.image || `assets/images/barber-${b.id}.jpg`;
                    return `
                        <div class="barber-select-item" data-id="${b.id}" data-name="${window.escapeHtml(b.name)}" data-specialty="${window.escapeHtml(b.specialty || 'Barber Specialist')}">
                            <div class="barber-avatar-sm">
                                <img src="${window.escapeHtml(img)}" alt="${window.escapeHtml(b.name)}">
                            </div>
                            <div class="barber-select-text">
                                <h4>${window.escapeHtml(b.name)}</h4>
                                <span>${window.escapeHtml(b.specialty || 'Barber Specialist')}</span>
                            </div>
                        </div>
                    `;
                }).join('') : '<p class="api-state">No barbers are currently available.</p>';
        } else {
            list.innerHTML = `<p class="api-state api-state-error">${window.escapeHtml(res.message || 'We couldn’t load barbers. Please refresh.')}</p>`;
        }
    } catch (e) {
        list.innerHTML = '<p class="api-state api-state-error">We couldn’t load barbers. Please refresh.</p>';
    }

    list.querySelectorAll('.barber-select-item').forEach(item => {
        item.addEventListener('click', () => selectBarberItem(item));
    });
}

function selectBarberItem(item) {
    document.querySelectorAll('.barber-select-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');

    bookingState.barber = {
        id: item.dataset.id,
        name: item.dataset.name,
        specialty: item.dataset.specialty
    };

    document.getElementById('step2NextBtn').disabled = false;
    updateSummary();

    if (bookingState.service && bookingState.date) {
        fetchAvailability();
    }
}

// Fetch availability from the booking engine. Slots are always server-derived.
async function fetchAvailability() {
    const grid = document.getElementById('slotsGrid');
    const note = document.getElementById('slotDurationNote');
    const loading = document.getElementById('slotsLoadingMsg');
    const nextBtn = document.getElementById('step3NextBtn');
    if (!grid) return;

    if (!bookingState.barber || !bookingState.date || !bookingState.service) {
        grid.innerHTML = '<p style="color: #65705f; grid-column: 1/-1; padding: 20px 0;">Please select a service and barber first.</p>';
        return;
    }

    if (note) {
        note.textContent = `Service duration: ${bookingState.service.duration} mins`;
    }

    if (loading) loading.style.display = 'block';
    grid.innerHTML = '';
    if (nextBtn) nextBtn.disabled = !bookingState.time;

    try {
        const query = `/bookings/availability?barber_id=${bookingState.barber.id}&service_id=${bookingState.service.id}&date=${bookingState.date}`;
        const res = await window.api.get(query);

        if (loading) loading.style.display = 'none';

        if (res.success && Array.isArray(res.data.slots)) {
            renderSlots(res.data.slots);
            return;
        }
    } catch (err) {
        // api.request returns a safe result, but retain this guard for unexpected errors.
    }

    if (loading) loading.style.display = 'none';
    grid.innerHTML = '<p class="api-state api-state-error">We couldn’t check availability. Please try again.</p>';
}

// Render dynamic slots from API response
function renderSlots(slots) {
    const grid = document.getElementById('slotsGrid');
    if (!grid) return;

    if (slots.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 30px; color: #879382;">
                <i class="fa-regular fa-calendar-xmark" style="font-size: 30px; margin-bottom: 8px;"></i>
                <p>No available slots for this date. The barber may be off or fully booked. Please try another day.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = slots.map(slot => {
        const isSelected = bookingState.time === slot.time;
        const disabledAttr = !slot.available ? 'disabled' : '';
        const selectedClass = isSelected ? 'selected' : '';
        return `
            <button type="button" class="slot-btn ${selectedClass}" data-time="${slot.time}" ${disabledAttr}>
                <span>${formatTimeLabel(slot.time)}</span>
            </button>
        `;
    }).join('');

    attachSlotClickListeners();
}

function attachSlotClickListeners() {
    document.querySelectorAll('.slot-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            bookingState.time = btn.dataset.time;
            document.getElementById('step3NextBtn').disabled = false;
            updateSummary();
        });
    });
}

function formatTimeLabel(timeStr) {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
}

// Update sticky summary sidebar in real-time
function updateSummary() {
    const serviceEl = document.getElementById('summaryService');
    const durationEl = document.getElementById('summaryDuration');
    const barberEl = document.getElementById('summaryBarber');
    const dateEl = document.getElementById('summaryDate');
    const timeEl = document.getElementById('summaryTime');
    const priceEl = document.getElementById('summaryPrice');

    if (serviceEl) serviceEl.textContent = bookingState.service ? bookingState.service.name : 'Not selected';
    if (durationEl) durationEl.textContent = bookingState.service ? `${bookingState.service.duration} mins` : '—';
    if (barberEl) barberEl.textContent = bookingState.barber ? bookingState.barber.name : 'Not selected';
    
    if (dateEl) {
        if (bookingState.date) {
            const d = new Date(bookingState.date + 'T00:00:00');
            dateEl.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else {
            dateEl.textContent = '—';
        }
    }

    if (timeEl) timeEl.textContent = bookingState.time ? formatTimeLabel(bookingState.time) : '—';
    if (priceEl) priceEl.textContent = bookingState.service ? `₱${bookingState.service.price.toLocaleString()}` : '₱0';
}

// Stepper Navigation
window.goToStep = function (stepNumber) {
    if (stepNumber < 1 || stepNumber > 4) return;

    // Validation checks before advancing
    if (stepNumber > 1 && !bookingState.service) {
        window.showToast('Please select a service first.', 'info');
        return;
    }
    if (stepNumber > 2 && !bookingState.barber) {
        window.showToast('Please select a barber first.', 'info');
        return;
    }
    if (stepNumber > 3 && (!bookingState.date || !bookingState.time)) {
        window.showToast('Please pick an available date and time slot.', 'info');
        return;
    }

    bookingState.step = stepNumber;

    // Update Panels
    document.querySelectorAll('.step-panel').forEach((panel, idx) => {
        panel.classList.toggle('active', idx + 1 === stepNumber);
    });

    // Update Stepper Nodes & Progress Fill
    const nodes = document.querySelectorAll('.step-node');
    nodes.forEach((node, idx) => {
        const num = idx + 1;
        node.classList.remove('active', 'completed');
        if (num === stepNumber) {
            node.classList.add('active');
        } else if (num < stepNumber) {
            node.classList.add('completed');
        }
    });

    const fillPercent = ((stepNumber - 1) / (nodes.length - 1)) * 100;
    const fillBar = document.getElementById('stepProgressFill');
    if (fillBar) fillBar.style.width = `${fillPercent}%`;

    window.scrollTo({ top: 120, behavior: 'smooth' });
};

window.jumpToStep = function (stepNumber) {
    // Only allow jumping backward or to next accessible step
    if (stepNumber < bookingState.step) {
        goToStep(stepNumber);
    } else if (stepNumber === bookingState.step + 1) {
        goToStep(stepNumber);
    }
};

// Handle final booking submission
window.handleBookingSubmit = async function (e) {
    e.preventDefault();

    const name = document.getElementById('custName').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const notes = document.getElementById('custNotes').value.trim();

    if (!bookingState.service || !bookingState.barber || !bookingState.date || !bookingState.time) {
        window.showToast('Please complete your service, barber, and time selection.', 'error');
        return;
    }
    if (!name || name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || !/^[0-9+()\s-]{7,30}$/.test(phone)) {
        window.showToast('Please provide a valid name, email, and phone number.', 'error');
        return;
    }

    const submitBtn = document.getElementById('confirmBookingBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reserving Chair...';

    const payload = {
        service_id: bookingState.service.id,
        barber_id: bookingState.barber.id,
        booking_date: bookingState.date,
        start_time: bookingState.time,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        notes: notes,
        payment_method: 'pay_at_shop'
    };

    try {
        const res = await window.api.post('/bookings', payload);

        if (res.success && res.data) {
            const booking = res.data;
            sessionStorage.setItem('ybc_confirmed_booking', JSON.stringify(booking));
            window.location.href = `confirmation.html?ref=${booking.booking_reference}`;
            return;
        } else {
            window.showToast(res.message || 'This appointment time is no longer available.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Confirm Booking <i class="fa-solid fa-check"></i>';
            
            // If conflict, refresh availability and send back to step 3
            if (res.status === 409 || res.message.includes('available')) {
                goToStep(3);
                fetchAvailability();
            }
        }
    } catch (err) {
        window.showToast('Unable to complete booking. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Confirm Booking <i class="fa-solid fa-check"></i>';
    }
};
