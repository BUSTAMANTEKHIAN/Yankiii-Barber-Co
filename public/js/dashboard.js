/**
 * Yankiii Barber Co. — Customer Dashboard Script
 *
 * Handles:
 * - Customer authentication
 * - User profile information
 * - Upcoming appointments
 * - Booking history
 * - Appointment cancellation
 * - Booking status display
 */

let myBookings = [];
let pendingCancelId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = window.api ? window.api.getUser() : null;
    const token = window.api ? window.api.getToken() : null;

    /*
     * Protect the dashboard.
     * Customers must be logged in to access their appointments.
     */
    if (!user || !token) {
        window.location.href = 'login.html';
        return;
    }

    /*
     * Populate customer information.
     */
    const firstName = user.name
        ? user.name.split(' ')[0]
        : 'Client';

    const dashUserName = document.getElementById('dashUserName');
    const sidebarUserName = document.getElementById('sidebarUserName');
    const sidebarUserEmail = document.getElementById('sidebarUserEmail');
    const userAvatarLetter = document.getElementById('userAvatarLetter');

    if (dashUserName) {
        dashUserName.textContent = firstName;
    }

    if (sidebarUserName) {
        sidebarUserName.textContent = user.name || 'Client';
    }

    if (sidebarUserEmail) {
        sidebarUserEmail.textContent = user.email || '';
    }

    if (userAvatarLetter) {
        userAvatarLetter.textContent =
            (user.name || 'U').charAt(0).toUpperCase();
    }

    /*
     * Load the customer's appointments.
     */
    await loadMyBookings();
});


/* =========================================================
   LOAD CUSTOMER BOOKINGS
========================================================= */

async function loadMyBookings() {
    try {
        const res = await window.api.get('/bookings/my');

        if (res.success && Array.isArray(res.data)) {
            myBookings = res.data;

            renderBookings();
            return;
        }
    } catch (error) {
        console.error(
            'Dashboard booking loading error:',
            error
        );
    }

    myBookings = [];

    window.showToast(
        'We couldn’t load your appointments. Please refresh.',
        'error'
    );

    renderBookings();
}


/* =========================================================
   RENDER BOOKINGS
========================================================= */

function renderBookings() {
    const upcomingContainer =
        document.getElementById('upcomingList');

    const historyContainer =
        document.getElementById('historyList');

    if (!upcomingContainer || !historyContainer) {
        return;
    }

    /*
     * Use local date rather than UTC so appointments do not
     * incorrectly move between days because of timezone conversion.
     */
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const todayStr = `${year}-${month}-${day}`;

    /*
     * Upcoming appointments:
     * - Today or future
     * - Pending or confirmed
     */
    const upcoming = myBookings.filter(booking => {
        const isFutureOrToday =
            booking.booking_date >= todayStr;

        const isActiveStatus =
            booking.status === 'pending' ||
            booking.status === 'confirmed';

        return (
            isFutureOrToday &&
            isActiveStatus
        );
    });

    /*
     * History:
     * - Past appointments
     * - Completed appointments
     * - Cancelled appointments
     */
    const history = myBookings.filter(booking => {
        const isPast =
            booking.booking_date < todayStr;

        const isTerminalStatus =
            booking.status === 'completed' ||
            booking.status === 'cancelled';

        return (
            isPast ||
            isTerminalStatus
        );
    });


    /* =====================================================
       UPCOMING APPOINTMENTS
    ===================================================== */

    if (upcoming.length === 0) {
        upcomingContainer.innerHTML = `
            <div class="empty-state">

                <i class="fa-regular fa-calendar"></i>

                <h3>
                    No upcoming appointments
                </h3>

                <p>
                    You don't have a scheduled appointment yet.
                    Book your next cut when you're ready.
                </p>

                <a
                    href="booking.html"
                    class="btn btn-primary btn-sm"
                >
                    <i class="fa-solid fa-calendar-plus"></i>
                    Schedule Now
                </a>

            </div>
        `;
    } else {
        upcomingContainer.innerHTML =
            upcoming
                .map(booking =>
                    renderAppointmentCard(
                        booking,
                        true
                    )
                )
                .join('');
    }


    /* =====================================================
       BOOKING HISTORY
    ===================================================== */

    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-state">

                <i class="fa-solid fa-clock-rotate-left"></i>

                <h3>
                    No past appointments yet
                </h3>

                <p>
                    Your completed and past bookings
                    will appear here.
                </p>

            </div>
        `;
    } else {
        historyContainer.innerHTML =
            history
                .map(booking =>
                    renderAppointmentCard(
                        booking,
                        false
                    )
                )
                .join('');
    }
}


/* =========================================================
   APPOINTMENT CARD
========================================================= */

function renderAppointmentCard(booking, isUpcoming) {
    /*
     * Format appointment date.
     */
    const dateFormatted = new Date(
        `${booking.booking_date}T00:00:00`
    ).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    /*
     * Format appointment time.
     */
    const [hourString, minuteString] =
        (booking.start_time || '00:00').split(':');

    let hour = parseInt(hourString, 10);

    const ampm = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12 || 12;

    const timeFormatted =
        `${hour}:${minuteString} ${ampm}`;

    /*
     * Appointment status.
     */
    const status =
        String(booking.status || 'pending').toLowerCase();

    const statusBadgeClass =
        `badge-${status}`;

    /*
     * Format price.
     */
    const formattedPrice =
        Number(booking.total_price || 0).toLocaleString(
            'en-PH',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

    /*
     * Cancellation button.
     *
     * This keeps your existing working cancellation system.
     */
    const cancelButton =
        isUpcoming &&
        booking.status !== 'cancelled'
            ? `
                <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    style="
                        border-color:#dc2626;
                        color:#dc2626;
                    "
                    onclick="openCancelModal(${booking.id})"
                >
                    <i class="fa-solid fa-xmark"></i>
                    Cancel Appointment
                </button>
            `
            : '';

    return `
        <article class="appointment-card">

            <!-- =========================================
                 APPOINTMENT HEADER
            ========================================== -->

            <div class="appointment-main-info">

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:flex-start;
                        gap:15px;
                        margin-bottom:15px;
                        flex-wrap:wrap;
                    "
                >

                    <div>

                        <span
                            style="
                                display:block;
                                font-size:11px;
                                font-weight:600;
                                text-transform:uppercase;
                                letter-spacing:.08em;
                                color:#6b7280;
                                margin-bottom:5px;
                            "
                        >
                            Booking ID
                        </span>

                        <span
                            style="
                                font-family:monospace;
                                font-weight:700;
                                font-size:14px;
                                color:#65705f;
                            "
                        >
                            ${escapeHtml(
                                booking.booking_reference || 'N/A'
                            )}
                        </span>

                    </div>

                    <span class="badge ${statusBadgeClass}">
                        ${escapeHtml(status)}
                    </span>

                </div>


                <!-- =====================================
                     SERVICE
                ====================================== -->

                <h3>
                    ${escapeHtml(
                        booking.service_name ||
                        'Haircut Service'
                    )}
                </h3>


                <!-- =====================================
                     APPOINTMENT DETAILS
                ====================================== -->

                <div
                    class="appointment-meta-row"
                    style="
                        margin-top:15px;
                    "
                >

                    <span>
                        <i class="fa-solid fa-user-tie"></i>
                        ${escapeHtml(
                            booking.barber_name || 'Barber'
                        )}
                    </span>

                    <span>
                        <i class="fa-regular fa-calendar"></i>
                        ${dateFormatted}
                    </span>

                    <span>
                        <i class="fa-regular fa-clock"></i>
                        ${timeFormatted}
                        ·
                        ${Number(
                            booking.duration || 30
                        )} min
                    </span>

                    <span>
                        <i class="fa-solid fa-tag"></i>
                        ₱${formattedPrice}
                    </span>

                </div>

            </div>


            <!-- =========================================
                 ACTIONS
            ========================================== -->

            <div class="appointment-right-action">

                ${cancelButton}

            </div>

        </article>
    `;
}


/* =========================================================
   TAB SWITCHING
========================================================= */

window.switchTab = function (tabName) {

    const upcomingBtn =
        document.getElementById(
            'tabBtnUpcoming'
        );

    const historyBtn =
        document.getElementById(
            'tabBtnHistory'
        );

    const upcomingContent =
        document.getElementById(
            'tabContentUpcoming'
        );

    const historyContent =
        document.getElementById(
            'tabContentHistory'
        );

    if (
        !upcomingBtn ||
        !historyBtn ||
        !upcomingContent ||
        !historyContent
    ) {
        return;
    }


    if (tabName === 'upcoming') {

        upcomingBtn.classList.add('active');

        historyBtn.classList.remove('active');

        upcomingContent.style.display =
            'block';

        historyContent.style.display =
            'none';

    } else {

        historyBtn.classList.add('active');

        upcomingBtn.classList.remove('active');

        historyContent.style.display =
            'block';

        upcomingContent.style.display =
            'none';
    }
};


/* =========================================================
   CANCEL MODAL
========================================================= */

window.openCancelModal = function (
    bookingId
) {
    pendingCancelId = bookingId;

    const modal =
        document.getElementById(
            'cancelModal'
        );

    if (modal) {
        modal.classList.add('active');
    }
};


window.closeCancelModal = function () {

    pendingCancelId = null;

    const modal =
        document.getElementById(
            'cancelModal'
        );

    if (modal) {
        modal.classList.remove('active');
    }
};


/* =========================================================
   EXECUTE CANCELLATION
========================================================= */

window.executeCancellation =
    async function () {

        if (!pendingCancelId) {
            return;
        }

        const btn =
            document.getElementById(
                'confirmCancelBtn'
            );

        if (!btn) {
            return;
        }

        /*
         * Prevent duplicate cancellation requests.
         */
        btn.disabled = true;

        btn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Cancelling...
        `;


        try {

            const res =
                await window.api.patch(
                    `/bookings/${pendingCancelId}`,
                    {
                        status: 'cancelled'
                    }
                );


            /*
             * Restore button state.
             */
            btn.disabled = false;

            btn.innerHTML =
                'Cancel Appointment';


            closeCancelModal();


            if (res.success) {

                window.showToast(
                    'Appointment cancelled successfully.',
                    'success'
                );


                /*
                 * Update local booking state
                 * immediately instead of requiring
                 * a page refresh.
                 */
                const target =
                    myBookings.find(
                        booking =>
                            booking.id ===
                            pendingCancelId
                    );

                if (target) {
                    target.status =
                        'cancelled';
                }


                renderBookings();

            } else {

                window.showToast(
                    res.message ||
                    'Unable to cancel appointment.',
                    'error'
                );
            }

        } catch (error) {

            console.error(
                'Cancellation error:',
                error
            );

            btn.disabled = false;

            btn.innerHTML =
                'Cancel Appointment';


            window.showToast(
                'Unable to cancel appointment. Please try again.',
                'error'
            );
        }
    };


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}