/**
 * Yankiii Barber Co. — Booking Controller
 *
 * Handles:
 * - Appointment availability
 * - Booking creation
 * - Booking confirmation emails
 * - Customer booking history
 * - Admin booking management
 * - Customer cancellation
 * - Appointment status updates
 */

'use strict';

const nodemailer = require('nodemailer');
const pool = require('../config/db');

const {
    timeToMinutes,
    minutesToTime,
    generateBookingReference,
    generateTimeSlots
} = require('../utils/bookingUtils');

/* =========================================================
   EMAIL CONFIGURATION
========================================================= */

const mailTransporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 465),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
});

/* =========================================================
   VALIDATION
========================================================= */

const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const phoneRegex =
    /^[0-9+()\s-]{7,30}$/;

function normalizePhilippineMobile(value) {
    const compact = value.replace(/[\s()-]/g, '');
    const normalized = compact.startsWith('+63') ? `0${compact.slice(3)}` : compact;
    return /^09\d{9}$/.test(normalized) ? normalized : null;
}

const dateRegex =
    /^\d{4}-\d{2}-\d{2}$/;

const timeRegex =
    /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const VALID_BOOKING_STATUSES = [
    'pending',
    'confirmed',
    'completed',
    'cancelled'
];

const CUSTOMER_CANCELLABLE_STATUSES = [
    'pending',
    'confirmed'
];

/* =========================================================
   DATE HELPERS
========================================================= */

function getTodayLocal() {
    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1)
            .padStart(2, '0');

    const day =
        String(now.getDate())
            .padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function validDate(date) {
    if (!dateRegex.test(date || '')) {
        return false;
    }

    const parsed =
        new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return false;
    }

    const [
        year,
        month,
        day
    ] = date
        .split('-')
        .map(Number);

    return (
        parsed.getFullYear() === year &&
        parsed.getMonth() + 1 === month &&
        parsed.getDate() === day
    );
}

function getDayOfWeek(date) {
    return new Date(
        `${date}T00:00:00`
    ).getDay();
}

/* =========================================================
   EMAIL HELPERS
========================================================= */

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatEmailDate(dateValue) {
    if (!dateValue) {
        return '—';
    }

    const date =
        new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return date.toLocaleDateString(
        'en-US',
        {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }
    );
}

function formatEmailTime(timeValue) {
    if (!timeValue) {
        return '—';
    }

    const parts =
        String(timeValue).split(':');

    let hour =
        Number.parseInt(parts[0], 10);

    const minute =
        parts[1] || '00';

    if (Number.isNaN(hour)) {
        return String(timeValue);
    }

    const ampm =
        hour >= 12
            ? 'PM'
            : 'AM';

    hour =
        hour % 12 || 12;

    return `${hour}:${minute} ${ampm}`;
}

function formatPaymentMethod(method) {
    const normalized =
        String(method || '')
            .toLowerCase()
            .trim();

    if (
        normalized === 'pay_at_shop' ||
        normalized === 'cash' ||
        normalized === 'cod'
    ) {
        return 'Pay at shop';
    }

    if (normalized === 'gcash') {
        return 'GCash';
    }

    if (normalized === 'paypal') {
        return 'PayPal';
    }

    return 'Pay at shop';
}

/* =========================================================
   SEND BOOKING CONFIRMATION EMAIL
========================================================= */

async function sendBookingConfirmationEmail(booking) {
    const customerName =
        escapeHtml(booking.customer_name);

    const customerEmail =
        booking.customer_email;

    const bookingReference =
        escapeHtml(
            booking.booking_reference
        );

    const serviceName =
        escapeHtml(
            booking.service_name
        );

    const barberName =
        escapeHtml(
            booking.barber_name
        );

    const formattedDate =
        formatEmailDate(
            booking.booking_date
        );

    const formattedTime =
        formatEmailTime(
            booking.start_time
        );

    const duration =
        Number(
            booking.duration || 0
        );

    const total =
        Number(
            booking.total_price || 0
        ).toLocaleString(
            'en-PH',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

    const paymentMethod =
        escapeHtml(
            formatPaymentMethod(
                booking.payment_method
            )
        );

    await mailTransporter.sendMail({
        from:
            `"Yankiii Barber Co." <${process.env.MAIL_USER}>`,

        to:
            customerEmail,

        replyTo:
            process.env.MAIL_USER,

        subject:
            `Yankiii Barber Co. — Appointment Confirmed (${booking.booking_reference})`,

        text: `
YANKIII BARBER CO.
APPOINTMENT CONFIRMED

Hi ${booking.customer_name},

Your appointment has been successfully reserved.

Booking ID: ${booking.booking_reference}

Service: ${booking.service_name}
Barber: ${booking.barber_name}
Date: ${formattedDate}
Time: ${formattedTime}
Duration: ${duration} minutes
Payment: ${formatPaymentMethod(booking.payment_method)}
Total: ₱${total}

Please keep your Booking ID for your records.

Thank you for choosing Yankiii Barber Co.
        `.trim(),

        html: `
<!DOCTYPE html>

<html>

<head>
    <meta charset="UTF-8">
    <title>Appointment Confirmed</title>
</head>

<body style="
    margin:0;
    padding:0;
    background:#f4f5f2;
    font-family:Arial,Helvetica,sans-serif;
    color:#1f2937;
">

    <div style="
        max-width:650px;
        margin:40px auto;
        background:#ffffff;
        border-radius:16px;
        overflow:hidden;
        border:1px solid #e5e7eb;
    ">

        <!-- HEADER -->

        <div style="
            background:#1f2a1f;
            padding:32px 25px;
            text-align:center;
        ">

            <h1 style="
                margin:0;
                color:#ffffff;
                font-size:26px;
                letter-spacing:1px;
            ">
                YANKIII BARBER CO.
            </h1>

            <p style="
                margin:10px 0 0;
                color:#d7e0d2;
                font-size:14px;
            ">
                Appointment Confirmation
            </p>

        </div>


        <!-- CONTENT -->

        <div style="
            padding:35px 30px;
        ">

            <div style="
                text-align:center;
                margin-bottom:30px;
            ">

                <div style="
                    width:58px;
                    height:58px;
                    margin:0 auto 15px;
                    border-radius:50%;
                    background:#e8f3ea;
                    color:#2f6b3f;
                    font-size:30px;
                    line-height:58px;
                ">
                    ✓
                </div>

                <h2 style="
                    margin:0;
                    font-size:24px;
                    color:#1f2937;
                ">
                    Appointment Confirmed
                </h2>

                <p style="
                    margin:10px 0 0;
                    color:#6b7280;
                    font-size:14px;
                    line-height:1.6;
                ">
                    Hi ${customerName}, your appointment has been successfully reserved.
                </p>

            </div>


            <!-- BOOKING ID -->

            <div style="
                background:#f5f7f3;
                border:1px solid #dfe5dc;
                border-radius:12px;
                padding:18px;
                text-align:center;
                margin-bottom:25px;
            ">

                <div style="
                    font-size:11px;
                    font-weight:bold;
                    text-transform:uppercase;
                    letter-spacing:1px;
                    color:#6b7280;
                    margin-bottom:8px;
                ">
                    Booking ID
                </div>

                <div style="
                    font-family:monospace;
                    font-size:18px;
                    font-weight:bold;
                    color:#65705f;
                ">
                    ${bookingReference}
                </div>

            </div>


            <!-- APPOINTMENT DETAILS -->

            <h3 style="
                margin:0 0 15px;
                font-size:16px;
                color:#1f2937;
            ">
                Appointment Details
            </h3>

            <table style="
                width:100%;
                border-collapse:collapse;
                font-size:14px;
            ">

                <tr>

                    <td style="
                        padding:12px 0;
                        color:#6b7280;
                        border-bottom:1px solid #eeeeee;
                    ">
                        Service
                    </td>

                    <td style="
                        padding:12px 0;
                        text-align:right;
                        font-weight:600;
                        border-bottom:1px solid #eeeeee;
                    ">
                        ${serviceName}
                    </td>

                </tr>

                <tr>

                    <td style="
                        padding:12px 0;
                        color:#6b7280;
                        border-bottom:1px solid #eeeeee;
                    ">
                        Barber
                    </td>

                    <td style="
                        padding:12px 0;
                        text-align:right;
                        font-weight:600;
                        border-bottom:1px solid #eeeeee;
                    ">
                        ${barberName}
                    </td>

                </tr>

                <tr>

                    <td style="
                        padding:12px 0;
                        color:#6b7280;
                        border-bottom:1px solid #eeeeee;
                    ">
                        Date
                    </td>

                    <td style="
                        padding:12px 0;
                        text-align:right;
                        font-weight:600;
                        border-bottom:1px solid #eeeeee;
                    ">
                        ${formattedDate}
                    </td>

                </tr>

                <tr>

                    <td style="
                        padding:12px 0;
                        color:#6b7280;
                        border-bottom:1px solid #eeeeee;
                    ">
                        Time
                    </td>

                    <td style="
                        padding:12px 0;
                        text-align:right;
                        font-weight:600;
                        border-bottom:1px solid #eeeeee;
                    ">
                        ${formattedTime}
                    </td>

                </tr>

                <tr>

                    <td style="
                        padding:12px 0;
                        color:#6b7280;
                        border-bottom:1px solid #eeeeee;
                    ">
                        Duration
                    </td>

                    <td style="
                        padding:12px 0;
                        text-align:right;
                        font-weight:600;
                        border-bottom:1px solid #eeeeee;
                    ">
                        ${duration} minutes
                    </td>

                </tr>

                <tr>

                    <td style="
                        padding:12px 0;
                        color:#6b7280;
                    ">
                        Payment
                    </td>

                    <td style="
                        padding:12px 0;
                        text-align:right;
                        font-weight:600;
                    ">
                        ${paymentMethod}
                    </td>

                </tr>

            </table>


            <!-- TOTAL -->

            <div style="
                margin-top:25px;
                padding:18px;
                background:#1f2a1f;
                border-radius:12px;
            ">

                <table style="
                    width:100%;
                    border-collapse:collapse;
                ">

                    <tr>

                        <td style="
                            color:#d7e0d2;
                            font-size:14px;
                        ">
                            Total
                        </td>

                        <td style="
                            color:#ffffff;
                            font-size:22px;
                            font-weight:bold;
                            text-align:right;
                        ">
                            ₱${total}
                        </td>

                    </tr>

                </table>

            </div>


            <p style="
                margin:30px 0 0;
                color:#6b7280;
                font-size:13px;
                line-height:1.7;
                text-align:center;
            ">
                Please keep your Booking ID for your records.
                You can manage your appointment through your
                Yankiii Barber Co. customer dashboard.
            </p>

        </div>


        <!-- FOOTER -->

        <div style="
            padding:20px 30px;
            background:#f8f9f7;
            border-top:1px solid #eeeeee;
            text-align:center;
        ">

            <p style="
                margin:0;
                color:#6b7280;
                font-size:12px;
            ">
                Thank you for choosing Yankiii Barber Co.
            </p>

        </div>

    </div>

</body>

</html>
        `
    });
}

/* =========================================================
   GET AVAILABILITY
========================================================= */

async function getAvailability(req, res) {
    try {
        const {
            barber_id,
            service_id,
            date
        } = req.query;

        if (
            !barber_id ||
            !service_id ||
            !date
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'barber_id, service_id, and date are required query parameters.'
            });
        }

        const barberId =
            Number.parseInt(
                barber_id,
                10
            );

        const serviceId =
            Number.parseInt(
                service_id,
                10
            );

        if (
            !Number.isInteger(barberId) ||
            barberId < 1 ||
            !Number.isInteger(serviceId) ||
            serviceId < 1 ||
            !validDate(date)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please provide valid barber, service, and appointment date.'
            });
        }

        const today =
            getTodayLocal();

        if (date < today) {
            return res.status(400).json({
                success: false,
                message:
                    'Cannot check availability for past dates.'
            });
        }

        const dayOfWeek =
            getDayOfWeek(date);

        const [
            barbers
        ] = await pool.query(
            `
                SELECT
                    id,
                    name,
                    status
                FROM barbers
                WHERE id = ?
                LIMIT 1
            `,
            [barberId]
        );

        if (
            barbers.length === 0 ||
            barbers[0].status !== 'active'
        ) {
            return res.status(404).json({
                success: false,
                message:
                    'The selected barber is unavailable.'
            });
        }

        const [
            services
        ] = await pool.query(
            `
                SELECT
                    id,
                    name,
                    duration,
                    status
                FROM services
                WHERE id = ?
                LIMIT 1
            `,
            [serviceId]
        );

        if (
            services.length === 0 ||
            services[0].status !== 'active'
        ) {
            return res.status(404).json({
                success: false,
                message:
                    'The selected service is unavailable.'
            });
        }

        const durationMins =
            Number(services[0].duration);

        if (
            !Number.isInteger(durationMins) ||
            durationMins < 15 ||
            durationMins > 480
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'The selected service has an invalid duration.'
            });
        }

        const [
            businessHoursRows
        ] = await pool.query(
            `
                SELECT
                    is_open,
                    open_time,
                    close_time
                FROM business_hours
                WHERE day_of_week = ?
                LIMIT 1
            `,
            [dayOfWeek]
        );

        if (
            businessHoursRows.length === 0
        ) {
            return res.status(200).json({
                success: true,
                data: {
                    barber_id: barberId,
                    service_id: serviceId,
                    date,
                    duration: durationMins,
                    day_of_week: dayOfWeek,
                    is_barber_working: false,
                    is_shop_open: false,
                    slots: []
                }
            });
        }

        const businessHour =
            businessHoursRows[0];

        const [
            barberScheduleRows
        ] = await pool.query(
            `
                SELECT
                    is_working,
                    start_time,
                    end_time
                FROM barber_schedules
                WHERE barber_id = ?
                  AND day_of_week = ?
                LIMIT 1
            `,
            [
                barberId,
                dayOfWeek
            ]
        );

        if (
            barberScheduleRows.length === 0
        ) {
            return res.status(200).json({
                success: true,
                data: {
                    barber_id: barberId,
                    service_id: serviceId,
                    date,
                    duration: durationMins,
                    day_of_week: dayOfWeek,
                    is_barber_working: false,
                    is_shop_open: Boolean(
                        businessHour.is_open
                    ),
                    slots: []
                }
            });
        }

        const barberSchedule =
            barberScheduleRows[0];

        const [
            existingBookings
        ] = await pool.query(
            `
                SELECT
                    start_time,
                    end_time,
                    status
                FROM bookings
                WHERE barber_id = ?
                  AND booking_date = ?
                  AND status != 'cancelled'
            `,
            [
                barberId,
                date
            ]
        );

        const slots =
            businessHour.is_open &&
            barberSchedule.is_working
                ? generateTimeSlots(
                    businessHour,
                    barberSchedule,
                    existingBookings,
                    durationMins,
                    date
                )
                : [];

        return res.status(200).json({
            success: true,
            data: {
                barber_id: barberId,
                service_id: serviceId,
                date,
                duration: durationMins,
                day_of_week: dayOfWeek,
                is_barber_working:
                    Boolean(
                        barberSchedule.is_working
                    ),
                is_shop_open:
                    Boolean(
                        businessHour.is_open
                    ),
                slots
            }
        });

    } catch (error) {
        console.error(
            'GetAvailability Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to calculate availability at this time.'
        });
    }
}

/* =========================================================
   CREATE BOOKING
========================================================= */

async function createBooking(req, res) {
    let connection;

    try {
        connection =
            await pool.getConnection();

        const {
            service_id,
            barber_id,
            booking_date,
            start_time,
            customer_name,
            customer_email,
            customer_phone,
            notes,
            payment_method
        } = req.body;

        if (
            !service_id ||
            !barber_id ||
            !booking_date ||
            !start_time ||
            !customer_name ||
            !customer_email ||
            !customer_phone
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'All required booking fields must be provided.'
            });
        }

        if (
            typeof customer_name !== 'string' ||
            typeof customer_email !== 'string' ||
            typeof customer_phone !== 'string' ||
            typeof start_time !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please review the appointment information.'
            });
        }

        const normalizedName =
            customer_name.trim();

        const normalizedEmail =
            customer_email
                .toLowerCase()
                .trim();

        const normalizedPhone =
            normalizePhilippineMobile(customer_phone.trim());

        if (
            !emailRegex.test(
                normalizedEmail
            ) ||
            !normalizedPhone
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please provide a valid email address and phone number.'
            });
        }

        if (
            !validDate(
                booking_date
            ) ||
            !timeRegex.test(
                start_time
            ) ||
            normalizedName.length < 2 ||
            normalizedName.length > 100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Please review the appointment date, time, and customer name.'
            });
        }

        if (
            booking_date <
            getTodayLocal()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Appointments cannot be made in the past.'
            });
        }

        await connection.beginTransaction();

        const [
            services
        ] = await connection.query(
            `
                SELECT
                    id,
                    name,
                    price,
                    duration,
                    status
                FROM services
                WHERE id = ?
                LIMIT 1
            `,
            [service_id]
        );

        if (
            services.length === 0 ||
            services[0].status !== 'active'
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'The selected service is invalid or currently unavailable.'
            });
        }

        const service =
            services[0];

        const verifiedDuration =
            Number(service.duration);

        const verifiedPrice =
            service.price;

        if (
            !Number.isInteger(
                verifiedDuration
            ) ||
            verifiedDuration < 15 ||
            verifiedDuration > 480
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'The selected service has an invalid duration.'
            });
        }

        const [
            barbers
        ] = await connection.query(
            `
                SELECT
                    id,
                    name,
                    status
                FROM barbers
                WHERE id = ?
                LIMIT 1
            `,
            [barber_id]
        );

        if (
            barbers.length === 0 ||
            barbers[0].status !== 'active'
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'The selected barber is invalid or inactive.'
            });
        }

        const barber =
            barbers[0];

        const formattedStartTime =
            start_time.length === 5
                ? `${start_time}:00`
                : start_time;

        const startMins =
            timeToMinutes(
                formattedStartTime
            );

        const endMins =
            startMins +
            verifiedDuration;

        const formattedEndTime =
            minutesToTime(
                endMins
            );

        if (
            !Number.isFinite(startMins) ||
            !Number.isFinite(endMins) ||
            endMins > 24 * 60
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'The selected appointment time is invalid.'
            });
        }

        const appointmentDay =
            getDayOfWeek(
                booking_date
            );

        const [
            businessHours
        ] = await connection.query(
            `
                SELECT
                    is_open,
                    open_time,
                    close_time
                FROM business_hours
                WHERE day_of_week = ?
                LIMIT 1
                FOR UPDATE
            `,
            [appointmentDay]
        );

        if (
            businessHours.length === 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'The shop schedule is not configured for this day.'
            });
        }

        const businessHour =
            businessHours[0];

        const [
            barberSchedules
        ] = await connection.query(
            `
                SELECT
                    is_working,
                    start_time,
                    end_time
                FROM barber_schedules
                WHERE barber_id = ?
                  AND day_of_week = ?
                LIMIT 1
                FOR UPDATE
            `,
            [
                barber.id,
                appointmentDay
            ]
        );

        if (
            barberSchedules.length === 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'The selected barber does not have a schedule configured for this day.'
            });
        }

        const barberSchedule =
            barberSchedules[0];

        if (
            !businessHour.is_open ||
            !barberSchedule.is_working
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'The shop or barber is unavailable on this date.'
            });
        }

        const earliestStart =
            Math.max(
                timeToMinutes(
                    businessHour.open_time
                ),
                timeToMinutes(
                    barberSchedule.start_time
                )
            );

        const latestEnd =
            Math.min(
                timeToMinutes(
                    businessHour.close_time
                ),
                timeToMinutes(
                    barberSchedule.end_time
                )
            );

        if (
            startMins <
                earliestStart ||
            endMins >
                latestEnd ||
            startMins % 30 !== 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    'That appointment time is outside the available schedule.'
            });
        }

        const [
            overlapping
        ] = await connection.query(
            `
                SELECT
                    id,
                    booking_reference,
                    start_time,
                    end_time
                FROM bookings
                WHERE barber_id = ?
                  AND booking_date = ?
                  AND status != 'cancelled'
                  AND start_time < ?
                  AND end_time > ?
                FOR UPDATE
            `,
            [
                barber.id,
                booking_date,
                formattedEndTime,
                formattedStartTime
            ]
        );

        if (
            overlapping.length > 0
        ) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    'This appointment time is no longer available.'
            });
        }

        const reference =
            generateBookingReference(
                booking_date
            );

        let userId = null;

        let bookingName =
            normalizedName;

        let bookingEmail =
            normalizedEmail;

        let bookingPhone =
            normalizedPhone;

        if (req.user) {
            const [
                users
            ] = await connection.query(
                `
                    SELECT
                        id,
                        name,
                        email,
                        phone,
                        role
                    FROM users
                    WHERE id = ?
                    LIMIT 1
                `,
                [req.user.id]
            );

            if (
                users.length === 0
            ) {
                await connection.rollback();

                return res.status(401).json({
                    success: false,
                    message:
                        'Your account could not be verified. Please log in again.'
                });
            }

            const user =
                users[0];

            userId =
                user.id;

            bookingName =
                user.name;

            bookingEmail =
                user.email;

            bookingPhone =
                user.phone || '';

            if (!bookingPhone) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        'Please add a phone number to your account before booking.'
                });
            }
        }

        const [
            insertResult
        ] = await connection.query(
            `
                INSERT INTO bookings
                (
                    booking_reference,
                    user_id,
                    customer_name,
                    customer_email,
                    customer_phone,
                    barber_id,
                    service_id,
                    booking_date,
                    start_time,
                    end_time,
                    total_price,
                    status,
                    notes,
                    payment_method
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'pending',
                    ?,
                    ?
                )
            `,
            [
                reference,
                userId,
                bookingName,
                bookingEmail,
                bookingPhone,
                barber.id,
                service.id,
                booking_date,
                formattedStartTime,
                formattedEndTime,
                verifiedPrice,
                notes
                    ? String(notes)
                        .trim()
                        .slice(0, 1000)
                    : null,
                payment_method ||
                    'pay_at_shop'
            ]
        );

        await connection.commit();

        /* =====================================================
           BOOKING DATA
        ===================================================== */

        const bookingData = {
            id:
                insertResult.insertId,

            booking_reference:
                reference,

            customer_name:
                bookingName,

            customer_email:
                bookingEmail,

            customer_phone:
                bookingPhone,

            service_name:
                service.name,

            barber_name:
                barber.name,

            booking_date,

            start_time:
                formattedStartTime,

            end_time:
                formattedEndTime,

            duration:
                verifiedDuration,

            total_price:
                verifiedPrice,

            status:
                'pending',

            payment_method:
                payment_method ||
                'pay_at_shop'
        };

        /* =====================================================
           SEND CONFIRMATION EMAIL

           Email failure does NOT cancel the booking.
        ===================================================== */

        let emailSent = false;

        try {
            await sendBookingConfirmationEmail(
                bookingData
            );

            emailSent = true;

            console.log(
                `Booking confirmation email sent for ${reference}`
            );

        } catch (emailError) {
            console.error(
                '⚠️ Booking confirmation email failed:',
                emailError.message
            );
        }

        /* =====================================================
           RESPONSE
        ===================================================== */

        return res.status(201).json({
            success: true,

            message:
                'Appointment reserved successfully.',

            data: {
                ...bookingData,
                email_sent:
                    emailSent
            }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Booking rollback error:',
                    rollbackError
                );
            }
        }

        console.error(
            'CreateBooking Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to create booking. Please try again.'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/* =========================================================
   GET CUSTOMER BOOKINGS
========================================================= */

async function getMyBookings(req, res) {
    try {
        const userId =
            req.user.id;

        const [
            rows
        ] = await pool.query(
            `
                SELECT
                    b.id,
                    b.booking_reference,
                    b.booking_date,
                    b.start_time,
                    b.end_time,
                    b.total_price,
                    b.status,
                    b.notes,
                    b.payment_method,
                    s.name AS service_name,
                    s.duration,
                    br.name AS barber_name
                FROM bookings b
                JOIN services s
                    ON b.service_id = s.id
                JOIN barbers br
                    ON b.barber_id = br.id
                WHERE b.user_id = ?
                ORDER BY
                    b.booking_date DESC,
                    b.start_time DESC
            `,
            [userId]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error(
            'GetMyBookings Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to retrieve your appointments.'
        });
    }
}

/* =========================================================
   GET ALL BOOKINGS
========================================================= */

async function getAllBookings(req, res) {
    try {
        const {
            status,
            date,
            search
        } = req.query;

        if (
            status &&
            status !== 'all' &&
            !VALID_BOOKING_STATUSES.includes(
                status
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Invalid status filter. Status must be one of: ${VALID_BOOKING_STATUSES.join(', ')}.`
            });
        }

        let query = `
            SELECT
                b.id,
                b.booking_reference,
                b.customer_name,
                b.customer_email,
                b.customer_phone,
                b.booking_date,
                b.start_time,
                b.end_time,
                b.total_price,
                b.status,
                b.notes,
                b.payment_method,
                b.created_at,
                s.name AS service_name,
                s.duration,
                br.name AS barber_name
            FROM bookings b
            JOIN services s
                ON b.service_id = s.id
            JOIN barbers br
                ON b.barber_id = br.id
            WHERE 1 = 1
        `;

        const params = [];

        if (
            status &&
            status !== 'all'
        ) {
            query += `
                AND b.status = ?
            `;

            params.push(status);
        }

        if (date) {
            if (!validDate(date)) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid booking date filter.'
                });
            }

            query += `
                AND b.booking_date = ?
            `;

            params.push(date);
        }

        if (search) {
            const normalizedSearch =
                String(search)
                    .trim();

            if (
                normalizedSearch.length >
                100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Search query is too long.'
                });
            }

            if (normalizedSearch) {
                query += `
                    AND (
                        b.booking_reference LIKE ?
                        OR b.customer_name LIKE ?
                        OR b.customer_phone LIKE ?
                        OR b.customer_email LIKE ?
                    )
                `;

                const term =
                    `%${normalizedSearch}%`;

                params.push(
                    term,
                    term,
                    term,
                    term
                );
            }
        }

        query += `
            ORDER BY
                b.booking_date DESC,
                b.start_time DESC
        `;

        const [
            rows
        ] = await pool.query(
            query,
            params
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error(
            'GetAllBookings Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to retrieve bookings list.'
        });
    }
}

/* =========================================================
   UPDATE BOOKING STATUS
========================================================= */

async function updateBookingStatus(req, res) {
    try {
        const id =
            Number.parseInt(
                req.params.id,
                10
            );

        const {
            status
        } = req.body;

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Invalid booking ID.'
            });
        }

        if (
            !status ||
            !VALID_BOOKING_STATUSES.includes(
                status
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Status must be one of: ${VALID_BOOKING_STATUSES.join(', ')}`
            });
        }

        if (
            req.user.role !== 'admin'
        ) {
            if (
                status !== 'cancelled'
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Customers may only cancel appointments.'
                });
            }

            const [
                existing
            ] = await pool.query(
                `
                    SELECT
                        id,
                        user_id,
                        customer_email,
                        booking_date,
                        start_time,
                        status
                    FROM bookings
                    WHERE id = ?
                    LIMIT 1
                `,
                [id]
            );

            if (
                existing.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Booking not found.'
                });
            }

            const booking =
                existing[0];

            const isOwner =
                booking.user_id ===
                    req.user.id ||
                (
                    booking.user_id === null &&
                    booking.customer_email ===
                        req.user.email
                );

            if (!isOwner) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Unauthorized to modify this appointment.'
                });
            }

            if (
                booking.status ===
                'cancelled'
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'This appointment is already cancelled.'
                });
            }

            if (
                !CUSTOMER_CANCELLABLE_STATUSES.includes(
                    booking.status
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'This appointment can no longer be cancelled.'
                });
            }

            const today =
                getTodayLocal();

            if (
                booking.booking_date <
                today
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Past appointments can no longer be cancelled.'
                });
            }

            if (
                booking.booking_date ===
                today
            ) {
                const now =
                    new Date();

                const currentMinutes =
                    now.getHours() * 60 +
                    now.getMinutes();

                const appointmentMinutes =
                    timeToMinutes(
                        booking.start_time
                    );

                if (
                    appointmentMinutes <=
                    currentMinutes
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'This appointment time has already started or passed.'
                    });
                }
            }
        }

        const [
            result
        ] = await pool.query(
            `
                UPDATE bookings
                SET status = ?
                WHERE id = ?
            `,
            [
                status,
                id
            ]
        );

        if (
            result.affectedRows === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    'Booking not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message:
                `Booking status updated to ${status}.`
        });

    } catch (error) {
        console.error(
            'UpdateBookingStatus Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Unable to update booking status.'
        });
    }
}

/* =========================================================
   GET BOOKING BY REFERENCE
========================================================= */

async function getBookingByReference(req, res) {
    try {
        const reference = (req.params.reference || req.query.ref || '').trim();

        if (!reference) {
            return res.status(400).json({
                success: false,
                message: 'Booking reference is required.'
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                b.id,
                b.booking_reference,
                b.customer_name,
                b.customer_email,
                b.customer_phone,
                b.booking_date,
                b.start_time,
                b.end_time,
                b.total_price,
                b.status,
                b.notes,
                b.payment_method,
                b.created_at,
                s.name AS service_name,
                s.duration,
                s.price AS service_price,
                bar.name AS barber_name
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN barbers bar ON b.barber_id = bar.id
            WHERE LOWER(b.booking_reference) = LOWER(?)
            LIMIT 1
            `,
            [reference]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found. Please verify your reference number.'
            });
        }

        const booking = rows[0];

        return res.status(200).json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error('GetBookingByReference Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve appointment details.'
        });
    }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
    getAvailability,
    createBooking,
    getBookingByReference,
    getMyBookings,
    getAllBookings,
    updateBookingStatus
};

