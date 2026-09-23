/**
 * Yankiii Barber Co. — Appointment Confirmation
 *
 * Loads the newly created booking from the confirmation
 * data saved by the booking flow.
 */

document.addEventListener('DOMContentLoaded', async () => {

    const loading =
        document.getElementById('confirmationLoading');

    const content =
        document.getElementById('confirmationContent');

    const errorState =
        document.getElementById('confirmationError');

    const referenceElement =
        document.getElementById('bookingReference');

    const copyButton =
        document.getElementById('copyBookingBtn');

    /*
     * The booking flow should save the created booking
     * before redirecting to confirmation.html.
     *
     * We support several common storage names so this
     * page remains compatible with the existing project.
     */

    let booking = null;

    const possibleKeys = [
        'ybc_last_booking',
        'ybc_booking',
        'ybc_confirmation'
    ];

    for (const key of possibleKeys) {

        const stored =
            localStorage.getItem(key);

        if (!stored) {
            continue;
        }

        try {

            booking = JSON.parse(stored);

            if (booking) {
                break;
            }

        } catch (error) {

            console.warn(
                `Invalid booking data in localStorage key: ${key}`
            );

        }
    }

    /*
     * Some booking flows may redirect using:
     *
     * confirmation.html?booking=123
     *
     * If an ID exists, try loading the customer's
     * bookings from the authenticated API.
     */

    const urlParams =
        new URLSearchParams(window.location.search);

    const bookingId =
        urlParams.get('booking');

    if (!booking && bookingId) {

        try {

            const response =
                await window.api.get('/bookings/my');

            if (
                response.success &&
                Array.isArray(response.data)
            ) {

                booking =
                    response.data.find(
                        item =>
                            String(item.id) ===
                            String(bookingId)
                    );
            }

        } catch (error) {

            console.error(
                'Unable to retrieve booking:',
                error
            );

        }
    }

    /*
     * No booking information.
     */

    if (!booking) {

        showError();

        return;
    }


    /*
     * Populate confirmation information.
     */

    populateBooking(booking);


    /*
     * Copy Booking ID.
     */

    if (copyButton && referenceElement) {

        copyButton.addEventListener(
            'click',
            async () => {

                const reference =
                    referenceElement.textContent.trim();

                if (
                    !reference ||
                    reference === '—'
                ) {
                    return;
                }

                try {

                    await navigator.clipboard.writeText(
                        reference
                    );

                    copyButton.innerHTML =
                        '<i class="fa-solid fa-check"></i>';

                    copyButton.title =
                        'Copied';

                    window.showToast?.(
                        'Booking ID copied.',
                        'success'
                    );

                    setTimeout(() => {

                        copyButton.innerHTML =
                            '<i class="fa-regular fa-copy"></i>';

                        copyButton.title =
                            'Copy Booking ID';

                    }, 1500);

                } catch (error) {

                    console.error(
                        'Copy booking ID error:',
                        error
                    );

                    window.showToast?.(
                        'Unable to copy Booking ID.',
                        'error'
                    );
                }
            }
        );
    }

});


function populateBooking(booking) {

    const loading =
        document.getElementById('confirmationLoading');

    const content =
        document.getElementById('confirmationContent');

    if (loading) {
        loading.style.display = 'none';
    }

    if (content) {
        content.style.display = 'block';
    }


    /*
     * Booking reference
     */

    const reference =
        booking.booking_reference ||
        booking.reference ||
        `YBC-${booking.id || 'N/A'}`;

    setText(
        'bookingReference',
        reference
    );


    /*
     * Service
     */

    setText(
        'bookingService',
        booking.service_name ||
        booking.service ||
        'Haircut Service'
    );


    /*
     * Barber
     */

    setText(
        'bookingBarber',
        booking.barber_name ||
        booking.barber ||
        'Barber'
    );


    /*
     * Date
     */

    setText(
        'bookingDate',
        formatDate(
            booking.booking_date ||
            booking.date
        )
    );


    /*
     * Time
     */

    setText(
        'bookingTime',
        formatTime(
            booking.start_time ||
            booking.time
        )
    );


    /*
     * Duration
     */

    const duration =
        Number(
            booking.duration ||
            booking.service_duration ||
            30
        );

    setText(
        'bookingDuration',
        `${duration} minutes`
    );


    /*
     * Payment
     */

    const payment =
        booking.payment_method ||
        booking.payment ||
        'Cash';

    setText(
        'bookingPayment',
        formatPaymentMethod(payment)
    );


    /*
     * Total
     */

    const total =
        Number(
            booking.total_price ||
            booking.price ||
            0
        );

    setText(
        'bookingTotal',
        `₱${total.toLocaleString(
            'en-PH',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )}`
    );


    /*
     * Status
     */

    updateStatus(
        booking.status
    );
}


function updateStatus(status) {

    const statusElement =
        document.getElementById(
            'confirmationStatus'
        );

    const statusText =
        document.getElementById(
            'confirmationStatusText'
        );

    const title =
        document.getElementById(
            'confirmationTitle'
        );

    const message =
        document.getElementById(
            'confirmationMessage'
        );

    const icon =
        document.getElementById(
            'confirmationIcon'
        );

    if (!statusElement || !statusText) {
        return;
    }

    const normalizedStatus =
        String(
            status ||
            'pending'
        ).toLowerCase();


    /*
     * Reset status classes.
     */

    statusElement.classList.remove(
        'status-confirmed',
        'status-completed',
        'status-cancelled'
    );


    /*
     * Pending
     */

    if (normalizedStatus === 'pending') {

        statusText.textContent =
            'Pending confirmation';

        statusElement.innerHTML = `
            <i class="fa-regular fa-clock"></i>
            <span>Pending confirmation</span>
        `;

        if (title) {
            title.textContent =
                'Appointment Reserved';
        }

        if (message) {
            message.textContent =
                'Your appointment has been successfully reserved and is awaiting confirmation.';
        }

        return;
    }


    /*
     * Confirmed
     */

    if (normalizedStatus === 'confirmed') {

        statusElement.classList.add(
            'status-confirmed'
        );

        statusElement.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>Confirmed</span>
        `;

        if (title) {
            title.textContent =
                'Appointment Confirmed';
        }

        if (message) {
            message.textContent =
                'Your appointment has been confirmed. We look forward to seeing you.';
        }

        return;
    }


    /*
     * Completed
     */

    if (normalizedStatus === 'completed') {

        statusElement.classList.add(
            'status-completed'
        );

        statusElement.innerHTML = `
            <i class="fa-solid fa-check-double"></i>
            <span>Completed</span>
        `;

        if (title) {
            title.textContent =
                'Appointment Completed';
        }

        if (message) {
            message.textContent =
                'This appointment has already been completed.';
        }

        return;
    }


    /*
     * Cancelled
     */

    if (normalizedStatus === 'cancelled') {

        statusElement.classList.add(
            'status-cancelled'
        );

        statusElement.innerHTML = `
            <i class="fa-solid fa-circle-xmark"></i>
            <span>Cancelled</span>
        `;

        if (title) {
            title.textContent =
                'Appointment Cancelled';
        }

        if (message) {
            message.textContent =
                'This appointment has been cancelled.';
        }

        if (icon) {
            icon.className =
                'fa-solid fa-xmark';
        }

        return;
    }


    /*
     * Fallback
     */

    statusElement.innerHTML = `
        <i class="fa-regular fa-clock"></i>
        <span>${escapeHtml(normalizedStatus)}</span>
    `;
}


function formatDate(dateValue) {

    if (!dateValue) {
        return '—';
    }

    const date =
        new Date(
            `${dateValue}T00:00:00`
        );

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return date.toLocaleDateString(
        'en-PH',
        {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }
    );
}


function formatTime(timeValue) {

    if (!timeValue) {
        return '—';
    }

    const parts =
        String(timeValue).split(':');

    let hour =
        parseInt(parts[0], 10);

    const minute =
        parts[1] || '00';

    if (Number.isNaN(hour)) {
        return String(timeValue);
    }

    const period =
        hour >= 12
            ? 'PM'
            : 'AM';

    hour =
        hour % 12 || 12;

    return `${hour}:${minute} ${period}`;
}


function formatPaymentMethod(value) {

    const normalized =
        String(value || '')
            .toLowerCase()
            .trim();

    const labels = {
        cod: 'Cash on Delivery',
        cash: 'Cash',
        gcash: 'GCash',
        paypal: 'PayPal'
    };

    return labels[normalized] ||
        String(value || 'Cash');
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent =
        value ?? '—';
}


function showError() {

    const loading =
        document.getElementById(
            'confirmationLoading'
        );

    const content =
        document.getElementById(
            'confirmationContent'
        );

    const errorState =
        document.getElementById(
            'confirmationError'
        );

    if (loading) {
        loading.style.display =
            'none';
    }

    if (content) {
        content.style.display =
            'none';
    }

    if (errorState) {
        errorState.style.display =
            'block';
    }
}


function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}