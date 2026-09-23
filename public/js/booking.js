/**
 * Yankiii Barber Co. — Booking Script
 *
 * Handles:
 * - Authentication protection
 * - Service loading
 * - Barber loading
 * - Any Available Barber
 * - Date selection
 * - Real-time availability
 * - Time-slot selection
 * - Logged-in customer prefilling
 * - Booking summary
 * - Booking submission
 * - Booking confirmation redirect
 */

'use strict';

/* =========================================================
   BOOKING STATE
========================================================= */

const bookingState = {
    service: null,
    barber: null,
    date: '',
    time: '',
    customer: {
        name: '',
        email: '',
        phone: '',
        notes: ''
    }
};

/*
 * Prevent an older availability request from
 * overwriting a newer request.
 */
let availabilityRequestId = 0;

/*
 * Tracks which wizard step is currently shown,
 * used to decide which step circles are clickable.
 */
let currentStep = 1;


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener('DOMContentLoaded', async () => {

    const token =
        localStorage.getItem('ybc_token');

    const user =
        localStorage.getItem('ybc_user');

    /*
     * booking-guard.js already protects the page.
     * This is an additional safety check.
     */
    if (!token || !user) {
        return;
    }

    setMinimumDate();
    buildQuickDateChips();
    resetTimeSlots();

    await loadServices();
    await loadBarbers();

    prefillLoggedInUser();

    setupEventListeners();

    updateSummary();

    updateStepUI();

    /*
     * Initialize the progress bar fill without
     * triggering goToStep's scroll-to-top on load.
     */
    const progressFill =
        document.getElementById('stepProgressFill');

    if (progressFill) {
        progressFill.style.width = '0%';
    }

});


/* =========================================================
   DATE SETUP
========================================================= */

function setMinimumDate() {

    const dateInput =
        document.getElementById('bookingDateInput');

    if (!dateInput) {
        return;
    }

    dateInput.min =
        toDateString(new Date());
}


/*
 * Formats a Date object as a local YYYY-MM-DD string,
 * matching what a <input type="date"> expects/returns.
 */
function toDateString(date) {

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, '0');

    const day =
        String(date.getDate())
            .padStart(2, '0');

    return `${year}-${month}-${day}`;

}


/* =========================================================
   QUICK DATE CHIPS
========================================================= */

function buildQuickDateChips() {

    const container =
        document.getElementById(
            'quickDateChips'
        );

    if (!container) {
        return;
    }

    container.innerHTML = '';

    const today =
        new Date();

    const dayCount = 7;

    for (let i = 0; i < dayCount; i++) {

        const date =
            new Date(today);

        date.setDate(
            today.getDate() + i
        );

        const dateString =
            toDateString(date);

        let label;

        if (i === 0) {
            label = 'Today';
        } else if (i === 1) {
            label = 'Tomorrow';
        } else {
            label = date.toLocaleDateString(
                'en-US',
                {
                    weekday: 'short',
                    day: 'numeric'
                }
            );
        }

        const chip =
            document.createElement('button');

        chip.type = 'button';
        chip.className = 'date-chip-btn';
        chip.dataset.date = dateString;
        chip.textContent = label;

        chip.addEventListener(
            'click',
            () => {
                applySelectedDate(dateString);
            }
        );

        container.appendChild(chip);

    }

}


function syncQuickDateChips(dateString) {

    document
        .querySelectorAll('.date-chip-btn')
        .forEach(chip => {

            chip.classList.toggle(
                'active',
                chip.dataset.date === dateString
            );

        });

}


/*
 * Single source of truth for "the user picked a date",
 * whether that came from a quick chip or the native
 * date input.
 */
function applySelectedDate(dateString) {

    const dateInput =
        document.getElementById('bookingDateInput');

    if (dateInput) {
        dateInput.value = dateString;
    }

    bookingState.date = dateString;
    bookingState.time = '';

    syncQuickDateChips(dateString);

    resetTimeSlots();
    updateSummary();

    if (
        bookingState.service &&
        bookingState.barber &&
        bookingState.date
    ) {
        fetchAvailability();
    }

    updateStepUI();

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    const dateInput =
        document.getElementById('bookingDateInput');

    const paymentSelect =
        document.getElementById('paymentMethod');

    const bookingForm =
        document.getElementById('bookingForm');

    /*
     * DATE
     */
    if (dateInput) {

        dateInput.addEventListener('change', () => {

            applySelectedDate(
                dateInput.value
            );

        });

    }


    /*
     * PAYMENT
     */
    if (paymentSelect) {

        paymentSelect.addEventListener(
            'change',
            updateSummary
        );

    }


    /*
     * FORM SUBMISSION
     */
    if (bookingForm) {

        bookingForm.addEventListener(
            'submit',
            handleBookingSubmit
        );

    }


    /*
     * STEP BUTTONS
     */

    const step1Next =
        document.getElementById('step1NextBtn');

    const step2Back =
        document.getElementById('step2BackBtn');

    const step2Next =
        document.getElementById('step2NextBtn');

    const step3Back =
        document.getElementById('step3BackBtn');

    const step3Next =
        document.getElementById('step3NextBtn');

    if (step1Next) {

        step1Next.addEventListener(
            'click',
            handleStep1Next
        );

    }

    if (step2Back) {

        step2Back.addEventListener(
            'click',
            () => {
                goToStep(1);
            }
        );

    }

    if (step2Next) {

        step2Next.addEventListener(
            'click',
            handleStep2Next
        );

    }

    if (step3Back) {

        step3Back.addEventListener(
            'click',
            () => {
                goToStep(2);
            }
        );

    }

    if (step3Next) {

        step3Next.addEventListener(
            'click',
            handleStep3Next
        );

    }


    /*
     * CLICK-OUTSIDE MODAL
     */

    const bookingModal =
        document.getElementById('bookingModal');

    if (bookingModal) {

        bookingModal.addEventListener(
            'click',
            event => {

                if (
                    event.target ===
                    bookingModal
                ) {

                    closeBookingModal();

                }

            }
        );

    }

}


/* =========================================================
   LOAD SERVICES
========================================================= */

async function loadServices() {

    const serviceList =
        document.getElementById(
            'serviceOptionsList'
        );

    if (!serviceList) {
        return;
    }

    try {

        serviceList.innerHTML = `
            <div class="api-state">
                Loading services...
            </div>
        `;

        const response =
            await window.api.get('/services');

        if (
            !response.success ||
            !Array.isArray(response.data)
        ) {

            serviceList.innerHTML = `
                <div class="api-state api-state-error">
                    Unable to load services.
                </div>
            `;

            return;
        }

        const activeServices =
            response.data.filter(
                service =>
                    service.status === 'active' ||
                    service.status === 1
            );

        window.yankiiiServices = activeServices;

        if (
            activeServices.length === 0
        ) {

            serviceList.innerHTML = `
                <div class="api-state">
                    No services are currently available.
                </div>
            `;

            return;
        }

        serviceList.innerHTML = '';

        activeServices.forEach(service => {

            const card =
                document.createElement('button');

            card.type = 'button';

            card.className =
                'service-select-item';

            card.dataset.serviceId =
                String(service.id);

            const price =
                Number(service.price || 0)
                    .toLocaleString(
                        'en-PH',
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }
                    );

            const duration =
                Number(service.duration || 30);

            const description =
                service.description
                    ? `<p>${escapeHtml(service.description)}</p>`
                    : '';

            card.innerHTML = `
                <span class="service-item-info">
                    <h4>${escapeHtml(service.name)}</h4>
                    ${description}
                </span>

                <span class="service-item-meta">
                    <span class="price">₱${price}</span>
                    <span class="duration">${duration} min</span>
                </span>
            `;

            card.addEventListener(
                'click',
                () => {

                    selectService(service);

                }
            );

            serviceList.appendChild(card);

        });

    } catch (error) {

        console.error(
            'Service loading error:',
            error
        );

        serviceList.innerHTML = `
            <div class="api-state api-state-error">
                Unable to load services.
                Please refresh and try again.
            </div>
        `;

    }

}

/* =========================================================
   SELECT SERVICE
========================================================= */

function selectService(service) {

    bookingState.service = {
        id: String(service.id),
        name: service.name,
        price: Number(service.price || 0),
        duration: Number(service.duration || 30)
    };

    bookingState.time = '';

    document.querySelectorAll('.service-select-item').forEach(item => {
        item.classList.remove('selected');
    });

    const selectedCard = document.querySelector(
        `.service-select-item[data-service-id="${String(service.id)}"]`
    );

    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    resetTimeSlots();
    updateSummary();

    const nextButton = document.getElementById('step1NextBtn');

    if (nextButton) {
        nextButton.disabled = false;
    }

    updateStepUI();
}


/* =========================================================
   LOAD BARBERS
========================================================= */

async function loadBarbers() {

    const barberList =
        document.getElementById(
            'barberOptionsList'
        );

    if (!barberList) {
        return;
    }

    try {

        barberList.innerHTML = `
            <div class="api-state">
                Loading barbers...
            </div>
        `;

        const response =
            await window.api.get('/barbers');

        if (
            !response.success ||
            !Array.isArray(response.data)
        ) {

            barberList.innerHTML = `
                <div class="api-state api-state-error">
                    Unable to load barbers.
                </div>
            `;

            return;
        }

        const activeBarbers =
            response.data.filter(
                barber =>
                    barber.status === 'active' ||
                    barber.status === 1
            );

        barberList.innerHTML = '';


        /*
         * ANY AVAILABLE BARBER
         */

        const anyCard =
            createBarberCard({

                id: 'any',

                name:
                    'Any Available Barber',

                specialty:
                    'Let us assign the next available barber',

                image:
                    null

            }, true);

        barberList.appendChild(
            anyCard
        );


        /*
         * DATABASE BARBERS
         */

        activeBarbers.forEach(barber => {

            const card =
                createBarberCard(
                    barber,
                    false
                );

            barberList.appendChild(
                card
            );

        });


        if (
            activeBarbers.length === 0
        ) {

            barberList.innerHTML = `
                <div class="api-state">
                    No barbers are currently available.
                </div>
            `;

        }

    } catch (error) {

        console.error(
            'Barber loading error:',
            error
        );

        barberList.innerHTML = `
            <div class="api-state api-state-error">
                Unable to load barbers.
                Please refresh and try again.
            </div>
        `;

    }

}


/* =========================================================
   CREATE BARBER CARD
========================================================= */

function createBarberCard(
    barber,
    isAny
) {

    const card =
        document.createElement('button');

    card.type = 'button';

    card.className =
        'barber-select-item';

    card.dataset.barberId =
        String(barber.id);


    const name =
        barber.name ||
        'Barber Specialist';

    const specialty =
        barber.specialty ||
        'Barber Specialist';


    let imagePath = 'assets/images/barber-1.jpg';
    if (isAny) {
        imagePath = 'assets/logo/logo.png';
    } else if (barber.image && typeof barber.image === 'string' && barber.image.trim()) {
        imagePath = barber.image.trim();
    } else if (Number(barber.id) >= 1 && Number(barber.id) <= 3) {
        imagePath = `assets/images/barber-${barber.id}.jpg`;
    }


    card.innerHTML = `

        <span class="barber-avatar-sm">

            <img
                src="${escapeHtml(imagePath)}"
                alt="${escapeHtml(name)}"
                loading="lazy"
                onerror="this.src='assets/logo/logo.png'"
            >

        </span>

        <span class="barber-select-text">

            <h4>${escapeHtml(name)}</h4>

            <span>${escapeHtml(specialty)}</span>

        </span>

    `;


    card.addEventListener(
        'click',
        () => {

            selectBarber(
                barber,
                isAny
            );

        }
    );


    return card;

}


/* =========================================================
   SELECT BARBER
========================================================= */

function selectBarber(
    barber,
    isAny = false
) {

    bookingState.barber = {

        id:
            String(barber.id),

        name:
            barber.name,

        specialty:
            barber.specialty ||
            'Barber Specialist'

    };

    bookingState.time = '';


    /*
     * Remove previous selection.
     */

    document
        .querySelectorAll(
            '.barber-select-item'
        )
        .forEach(item => {

            item.classList.remove(
                'selected'
            );

        });


    /*
     * Highlight selected barber.
     */

    const selectedCard =
        document.querySelector(
            `.barber-select-item[data-barber-id="${CSS.escape(
                String(barber.id)
            )}"]`
        );

    if (selectedCard) {

        selectedCard.classList.add(
            'selected'
        );

    }


    resetTimeSlots();

    updateSummary();

    updateStepUI();

}


/* =========================================================
   PREFILL LOGGED-IN USER
========================================================= */

function prefillLoggedInUser() {

    const user =
        window.api &&
        typeof window.api.getUser === 'function'
            ? window.api.getUser()
            : null;

    if (!user) {
        return;
    }


    const nameField =
        document.getElementById(
            'custName'
        );

    const emailField =
        document.getElementById(
            'custEmail'
        );

    const phoneField =
        document.getElementById(
            'custPhone'
        );


    if (
        nameField &&
        user.name
    ) {

        nameField.value =
            user.name;

    }


    if (
        emailField &&
        user.email
    ) {

        emailField.value =
            user.email;

    }


    if (
        phoneField &&
        user.phone
    ) {

        phoneField.value =
            user.phone;

    }

}


/* =========================================================
   AVAILABILITY
========================================================= */

async function fetchAvailability() {

    const slotsGrid =
        document.getElementById(
            'slotsGrid'
        );

    const message =
        document.getElementById(
            'slotDurationNote'
        );


    if (!slotsGrid) {
        return;
    }


    if (
        !bookingState.service ||
        !bookingState.barber ||
        !bookingState.date
    ) {

        resetTimeSlots();

        return;

    }


    const requestId =
        ++availabilityRequestId;


    bookingState.time = '';


    const loadingMsg =
        document.getElementById(
            'slotsLoadingMsg'
        );


    slotsGrid.innerHTML = '';
    slotsGrid.style.display = 'none';

    if (loadingMsg) {
        loadingMsg.style.display = 'block';
    }


    if (message) {

        message.textContent =
            'Checking available appointment times...';

    }


    try {

        /*
         * SPECIFIC BARBER
         */

        if (
            bookingState.barber.id !==
            'any'
        ) {

            const response =
                await getBarberAvailability(
                    bookingState.barber.id
                );


            if (
                requestId !==
                availabilityRequestId
            ) {

                return;

            }


            if (
                response.success &&
                response.data
            ) {

                renderTimeSlots(
                    response.data.slots || []
                );

                return;

            }


            renderNoAvailability(
                response.message ||
                'Unable to check availability.'
            );

            return;

        }


        /*
         * ANY AVAILABLE BARBER
         */

        const response =
            await getAnyBarberAvailability();


        if (
            requestId !==
            availabilityRequestId
        ) {

            return;

        }


        if (
            !response.slots ||
            response.slots.length === 0
        ) {

            renderNoAvailability(
                'No barber is available for this date.'
            );

            return;

        }


        renderTimeSlots(
            response.slots
        );


    } catch (error) {

        if (
            requestId !==
            availabilityRequestId
        ) {

            return;

        }


        console.error(
            'Availability error:',
            error
        );


        renderNoAvailability(
            'We could not check availability. Please try again.'
        );

    }

}


/* =========================================================
   SPECIFIC BARBER AVAILABILITY
========================================================= */

async function getBarberAvailability(
    barberId
) {

    const query =
        `/bookings/availability` +
        `?barber_id=${encodeURIComponent(
            barberId
        )}` +
        `&service_id=${encodeURIComponent(
            bookingState.service.id
        )}` +
        `&date=${encodeURIComponent(
            bookingState.date
        )}`;


    return await window.api.get(
        query
    );

}


/* =========================================================
   ANY BARBER AVAILABILITY
========================================================= */

async function getAnyBarberAvailability() {

    const response =
        await window.api.get(
            '/barbers'
        );


    if (
        !response.success ||
        !Array.isArray(
            response.data
        )
    ) {

        return {
            slots: []
        };

    }


    const activeBarbers =
        response.data.filter(
            barber =>
                barber.status === 'active' ||
                barber.status === 1
        );


    if (
        activeBarbers.length === 0
    ) {

        return {
            slots: []
        };

    }


    const availabilityResults =
        await Promise.all(
            activeBarbers.map(
                async barber => {

                    try {

                        const result =
                            await getBarberAvailability(
                                barber.id
                            );


                        if (
                            !result.success ||
                            !result.data ||
                            !Array.isArray(
                                result.data.slots
                            )
                        ) {

                            return [];

                        }


                        return result.data.slots
                            .filter(
                                slot =>
                                    slot.available !== false
                            )
                            .map(
                                slot => ({
                                    time:
                                        slot.time,

                                    available:
                                        true
                                })
                            );

                    } catch (error) {

                        console.error(
                            `Availability error for barber ${barber.id}:`,
                            error
                        );

                        return [];

                    }

                }
            )
        );


    /*
     * Merge duplicate times.
     */

    const merged =
        new Map();


    availabilityResults
        .flat()
        .forEach(slot => {

            if (
                !merged.has(
                    slot.time
                )
            ) {

                merged.set(
                    slot.time,
                    {
                        time:
                            slot.time,

                        available:
                            true
                    }
                );

            }

        });


    const slots =
        Array.from(
            merged.values()
        );


    slots.sort(
        (a, b) =>
            timeToMinutes(
                a.time
            ) -
            timeToMinutes(
                b.time
            )
    );


    return {
        slots
    };

}


/* =========================================================
   RENDER TIME SLOTS
========================================================= */

function renderTimeSlots(
    slots
) {

    const slotsGrid =
        document.getElementById(
            'slotsGrid'
        );

    const message =
        document.getElementById(
            'slotDurationNote'
        );


    if (!slotsGrid) {
        return;
    }


    if (
        !Array.isArray(slots) ||
        slots.length === 0
    ) {

        renderNoAvailability(
            'No available time slots for this date.'
        );

        return;

    }


    slotsGrid.innerHTML = '';
    slotsGrid.style.display = 'grid';

    const loadingMsg =
        document.getElementById(
            'slotsLoadingMsg'
        );

    if (loadingMsg) {
        loadingMsg.style.display = 'none';
    }


    slots.forEach(slot => {

        const isAvailable =
            slot.available !== false;

        const button =
            document.createElement(
                'button'
            );

        button.type =
            'button';

        button.className =
            'slot-btn';

        button.dataset.time =
            slot.time;

        button.disabled =
            !isAvailable;

        button.textContent =
            formatTimeLabel(
                slot.time
            );


        if (isAvailable) {

            button.addEventListener(
                'click',
                () => {

                    selectTimeSlot(
                        slot.time
                    );

                }
            );

        }


        slotsGrid.appendChild(
            button
        );

    });


    if (
        slotsGrid.children.length === 0 ||
        !slotsGrid.querySelector('.slot-btn:not(:disabled)')
    ) {

        renderNoAvailability(
            'No available time slots for this date.'
        );

        return;

    }


    if (message) {

        if (
            bookingState.barber.id ===
            'any'
        ) {

            message.textContent =
                'These times have at least one available barber. We will assign one automatically.';

        } else {

            message.textContent =
                `Available times for ${bookingState.barber.name}.`;

        }

    }

}


/* =========================================================
   SELECT TIME SLOT
========================================================= */

function selectTimeSlot(
    time
) {

    bookingState.time =
        time;


    document
        .querySelectorAll(
            '.slot-btn'
        )
        .forEach(button => {

            button.classList.toggle(
                'selected',
                button.dataset.time ===
                time
            );

        });


    updateSummary();

    updateStepUI();

}


/* =========================================================
   NO AVAILABILITY
========================================================= */

function renderNoAvailability(
    messageText
) {

    const slotsGrid =
        document.getElementById(
            'slotsGrid'
        );

    const message =
        document.getElementById(
            'slotDurationNote'
        );


    const loadingMsg =
        document.getElementById(
            'slotsLoadingMsg'
        );

    if (loadingMsg) {
        loadingMsg.style.display = 'none';
    }


    if (slotsGrid) {

        slotsGrid.style.display = 'grid';

        slotsGrid.innerHTML = `
            <div class="api-state">
                <i class="fa-regular fa-calendar-xmark" style="font-size:20px;margin-bottom:8px;display:block;"></i>
                No available time slots.
            </div>
        `;

    }


    if (message) {

        message.textContent =
            messageText;

    }


    bookingState.time = '';

    updateSummary();

}


/* =========================================================
   RESET TIME SLOTS
========================================================= */

function resetTimeSlots() {

    const slotsGrid =
        document.getElementById(
            'slotsGrid'
        );

    const message =
        document.getElementById(
            'slotDurationNote'
        );


    availabilityRequestId++;


    bookingState.time = '';


    const loadingMsg =
        document.getElementById(
            'slotsLoadingMsg'
        );

    if (loadingMsg) {
        loadingMsg.style.display = 'none';
    }


    if (slotsGrid) {

        slotsGrid.style.display = 'grid';

        slotsGrid.innerHTML = `
            <div class="api-state">
                Select a service, barber, and date first.
            </div>
        `;

    }


    if (message) {

        message.textContent =
            'Available appointment times will appear here.';

    }


    updateSummary();

}


/* =========================================================
   TIME FORMATTER
========================================================= */

function formatTimeLabel(
    time
) {

    if (!time) {
        return '';
    }


    const parts =
        String(time).split(':');


    let hour =
        Number.parseInt(
            parts[0],
            10
        );


    const minute =
        parts[1] || '00';


    if (
        Number.isNaN(hour)
    ) {

        return String(time);

    }


    const period =
        hour >= 12
            ? 'PM'
            : 'AM';


    hour =
        hour % 12 || 12;


    return `${hour}:${minute} ${period}`;

}


/* =========================================================
   TIME TO MINUTES
========================================================= */

function timeToMinutes(
    time
) {

    const [
        hours,
        minutes = '00'
    ] =
        String(time).split(':');


    return (
        Number(hours) * 60 +
        Number(minutes)
    );

}


/* =========================================================
   BOOKING SUMMARY
========================================================= */

function updateSummary() {

    const serviceElement =
        document.getElementById(
            'summaryService'
        );

    const barberElement =
        document.getElementById(
            'summaryBarber'
        );

    const dateElement =
        document.getElementById(
            'summaryDate'
        );

    const timeElement =
        document.getElementById(
            'summaryTime'
        );

    const durationElement =
        document.getElementById(
            'summaryDuration'
        );

    const paymentElement =
        document.getElementById(
            'summaryPayment'
        );

    const totalElement =
        document.getElementById(
            'summaryPrice'
        );


    /*
     * SERVICE
     */

    if (serviceElement) {

        serviceElement.textContent =
            bookingState.service
                ? bookingState.service.name
                : 'Not selected';

    }


    /*
     * BARBER
     */

    if (barberElement) {

        barberElement.textContent =
            bookingState.barber
                ? bookingState.barber.name
                : 'Not selected';

    }


    /*
     * DATE
     */

    if (dateElement) {

        if (
            bookingState.date
        ) {

            const date =
                new Date(
                    `${bookingState.date}T00:00:00`
                );


            dateElement.textContent =
                date.toLocaleDateString(
                    'en-US',
                    {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    }
                );

        } else {

            dateElement.textContent =
                'Not selected';

        }

    }


    /*
     * TIME
     */

    if (timeElement) {

        timeElement.textContent =
            bookingState.time
                ? formatTimeLabel(
                    bookingState.time
                )
                : 'Not selected';

    }


    /*
     * DURATION
     */

    if (durationElement) {

        durationElement.textContent =
            bookingState.service
                ? `${bookingState.service.duration} minutes`
                : '—';

    }


    /*
     * PAYMENT
     */

    const paymentSelect =
        document.getElementById(
            'paymentMethod'
        );


    if (paymentElement) {

        if (
            paymentSelect &&
            paymentSelect.value
        ) {

            const option =
                paymentSelect.options[
                    paymentSelect.selectedIndex
                ];


            paymentElement.textContent =
                option.textContent.trim();

        } else {

            paymentElement.textContent =
                'Pay at Shop';

        }

    }


    /*
     * TOTAL
     */

    if (totalElement) {

        const price =
            bookingState.service
                ? Number(
                    bookingState.service.price
                )
                : 0;


        totalElement.textContent =
            price.toLocaleString(
                'en-PH',
                {
                    style: 'currency',
                    currency: 'PHP',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );

    }

}


/* =========================================================
   CUSTOMER INFORMATION
========================================================= */

function getCustomerInformation() {

    const nameField =
        document.getElementById(
            'custName'
        );

    const emailField =
        document.getElementById(
            'custEmail'
        );

    const phoneField =
        document.getElementById(
            'custPhone'
        );

    const notesField =
        document.getElementById(
            'custNotes'
        );


    if (
        !nameField ||
        !emailField ||
        !phoneField
    ) {

        window.showToast(
            'Unable to read your booking information.',
            'error'
        );

        return null;

    }


    const name =
        nameField.value.trim();


    const email =
        emailField.value
            .trim()
            .toLowerCase();


    const phone =
        phoneField.value.trim();


    const notes =
        notesField
            ? notesField.value.trim()
            : '';


    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    const phonePattern =
        /^[0-9+()\s-]{7,30}$/;


    if (
        name.length < 2 ||
        name.length > 100
    ) {

        window.showToast(
            'Please enter your full name.',
            'error'
        );

        nameField.focus();

        return null;

    }


    if (
        !emailPattern.test(email)
    ) {

        window.showToast(
            'Please enter a valid email address.',
            'error'
        );

        emailField.focus();

        return null;

    }


    if (
        !phonePattern.test(phone)
    ) {

        window.showToast(
            'Please enter a valid phone number.',
            'error'
        );

        phoneField.focus();

        return null;

    }


    return {

        name,

        email,

        phone,

        notes

    };

}


/* =========================================================
   BOOKING SUBMISSION
========================================================= */

let isBookingSubmitting = false;

async function handleBookingSubmit(
    event
) {

    if (event && event.preventDefault) {
        event.preventDefault();
    }

    if (isBookingSubmitting) {
        return;
    }


    /*
     * AUTHENTICATION
     */

    const token =
        localStorage.getItem(
            'ybc_token'
        );

    const user =
        localStorage.getItem(
            'ybc_user'
        );


    if (
        !token ||
        !user
    ) {

        window.showToast(
            'Please, login first before booking appointment.',
            'info'
        );


        setTimeout(
            () => {

                window.location.href =
                    'register.html';

            },
            700
        );


        return;

    }


    /*
     * REQUIRED SELECTIONS
     */

    if (
        !bookingState.service
    ) {

        window.showToast(
            'Please select a service.',
            'error'
        );

        goToStep(1);

        return;

    }


    if (
        !bookingState.barber
    ) {

        window.showToast(
            'Please select a barber.',
            'error'
        );

        goToStep(2);

        return;

    }


    if (
        !bookingState.date
    ) {

        window.showToast(
            'Please select an appointment date.',
            'error'
        );

        goToStep(3);

        return;

    }


    if (
        !bookingState.time
    ) {

        window.showToast(
            'Please select an available time.',
            'error'
        );

        goToStep(3);

        return;

    }


    /*
     * CUSTOMER
     */

    const customer =
        getCustomerInformation();


    if (!customer) {
        return;
    }


    bookingState.customer =
        customer;


    /*
     * SUBMIT BUTTON
     */

    const submitButton =
        document.getElementById(
            'confirmBookingBtn'
        );


    if (!submitButton) {
        return;
    }


    submitButton.disabled =
        true;


    submitButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Reserving Chair...
    `;


    /*
     * PAYMENT
     */

    const paymentSelect =
        document.getElementById(
            'paymentMethod'
        );


    const paymentMethod =
        paymentSelect &&
        paymentSelect.value
            ? paymentSelect.value
            : 'pay_at_shop';


    /*
     * PAYLOAD
     */

    const payload = {

        service_id:
            bookingState.service.id,

        /*
         * If "Any Available Barber"
         * was selected, send "any".
         *
         * Backend is responsible for
         * assigning an available barber.
         */

        barber_id:
            bookingState.barber.id,

        booking_date:
            bookingState.date,

        start_time:
            bookingState.time,

        customer_name:
            customer.name,

        customer_email:
            customer.email,

        customer_phone:
            customer.phone,

        notes:
            customer.notes,

        payment_method:
            paymentMethod

    };


    isBookingSubmitting = true;

    try {

        const response =
            await window.api.post(
                '/bookings',
                payload
            );


        /*
         * SUCCESS
         */

        if (
            response.success &&
            response.data
        ) {

            const booking =
                response.data;


            /*
             * Store booking details
             * for confirmation.html.
             */

            sessionStorage.setItem(
                'ybc_confirmed_booking',
                JSON.stringify(
                    booking
                )
            );

            localStorage.setItem(
                'ybc_last_booking',
                JSON.stringify(
                    booking
                )
            );


            /*
             * Redirect to confirmation page.
             */

            window.location.href =
                `confirmation.html?ref=${encodeURIComponent(
                    booking.booking_reference ||
                    ''
                )}`;


            return;

        }


        /*
         * SERVER ERROR
         */

        isBookingSubmitting = false;

        const message =
            response.message ||
            'Unable to complete your booking.';


        window.showToast(
            message,
            'error'
        );


        submitButton.disabled =
            false;


        submitButton.innerHTML = `
            <i class="fa-solid fa-calendar-check"></i>
            Confirm Appointment
        `;


        /*
         * Refresh availability
         * when a booking conflict occurs.
         */

        const lowerMessage =
            String(
                message
            ).toLowerCase();


        const conflict =
            response.status === 409 ||
            lowerMessage.includes(
                'available'
            ) ||
            lowerMessage.includes(
                'booked'
            ) ||
            lowerMessage.includes(
                'conflict'
            );


        if (conflict) {

            bookingState.time = '';

            resetTimeSlots();


            if (
                bookingState.service &&
                bookingState.barber &&
                bookingState.date
            ) {

                await fetchAvailability();

            }

        }


    } catch (error) {

        isBookingSubmitting = false;

        console.error(
            'Booking submission error:',
            error
        );


        window.showToast(
            'Unable to complete booking. Please try again.',
            'error'
        );


        submitButton.disabled =
            false;


        submitButton.innerHTML = `
            <i class="fa-solid fa-calendar-check"></i>
            Confirm Appointment
        `;

    }

}


function handleStep1Next() {
    if (!bookingState.service) {
        window.showToast('Please select a service first.', 'error');
        return;
    }

    goToStep(2);
}


/* =========================================================
   STEP 2
========================================================= */

function handleStep2Next() {

    if (
        !bookingState.barber
    ) {

        window.showToast(
            'Please select a barber first.',
            'error'
        );

        return;

    }

    goToStep(3);

}


/* =========================================================
   STEP 3
========================================================= */

function handleStep3Next() {

    if (
        !bookingState.date
    ) {

        window.showToast(
            'Please select a date.',
            'error'
        );

        return;

    }


    if (
        !bookingState.time
    ) {

        window.showToast(
            'Please select an available time.',
            'error'
        );

        return;

    }


    updateSummary();

    goToStep(4);

}


/* =========================================================
   STEP NAVIGATION
========================================================= */

function goToStep(
    step
) {

    currentStep = step;


    const steps =
        document.querySelectorAll(
            '.step-node'
        );


    steps.forEach(
        stepElement => {

            const stepNumber =
                Number(
                    stepElement.dataset.step
                );


            stepElement.classList.toggle(
                'active',
                stepNumber === step
            );


            stepElement.classList.toggle(
                'completed',
                stepNumber < step
            );

        }
    );


    const panels =
        document.querySelectorAll(
            '.step-panel'
        );


    panels.forEach(
        panel => {

            const panelStep =
                Number(
                    panel.id.replace(
                        'stepPanel',
                        ''
                    )
                );


            panel.classList.toggle(
                'active',
                panelStep === step
            );

        }
    );


    /*
     * Update the connecting progress bar fill.
     * 4 steps -> 3 gaps between nodes (0%, 33%, 66%, 100%).
     */

    const progressFill =
        document.getElementById(
            'stepProgressFill'
        );

    if (progressFill) {

        const totalSteps = 4;

        const percent =
            ((step - 1) / (totalSteps - 1)) * 100;

        progressFill.style.width =
            `${percent}%`;

    }


    updateStepUI();


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });

}


/* =========================================================
   JUMP TO STEP (clicking a step circle)
========================================================= */

function getMaxUnlockedStep() {

    if (
        bookingState.date &&
        bookingState.time
    ) {
        return 4;
    }

    if (bookingState.barber) {
        return 3;
    }

    if (bookingState.service) {
        return 2;
    }

    return 1;

}

function jumpToStep(step) {

    const maxUnlocked =
        getMaxUnlockedStep();

    if (step > maxUnlocked) {

        window.showToast(
            'Please complete the current step first.',
            'error'
        );

        return;

    }

    goToStep(step);

}

window.jumpToStep = jumpToStep;


/* =========================================================
   STEP UI
========================================================= */

function updateStepUI() {

    const step1Next =
        document.getElementById(
            'step1NextBtn'
        );

    const step2Next =
        document.getElementById(
            'step2NextBtn'
        );

    const step3Next =
        document.getElementById(
            'step3NextBtn'
        );


    if (step1Next) {

        step1Next.disabled =
            !bookingState.service;

    }


    if (step2Next) {

        step2Next.disabled =
            !bookingState.barber;

    }


    if (step3Next) {

        step3Next.disabled =
            !bookingState.date ||
            !bookingState.time;

    }


    /*
     * Make sure the final summary
     * always reflects current state.
     */

    updateSummary();

}


/* =========================================================
   OPTIONAL BOOKING MODAL
========================================================= */

function closeBookingModal() {

    const modal =
        document.getElementById(
            'bookingModal'
        );

    if (!modal) {
        return;
    }

    modal.classList.remove(
        'active'
    );

}


window.closeBookingModal =
    closeBookingModal;


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ''
    )
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&#039;'
        );

}


/* =========================================================
   EXPORT STATE FOR DEBUGGING
========================================================= */

window.yankiiiBookingState =
    bookingState;