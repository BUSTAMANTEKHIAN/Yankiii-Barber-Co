/**
 * Yankiii Barber Co. — Booking Controller
 *
 * Handles:
 * - Availability calculation
 * - Variable duration scheduling
 * - Atomic double-booking prevention
 * - Customer/admin booking management
 */

const pool = require('../config/db');

const {
    timeToMinutes,
    minutesToTime,
    generateBookingReference,
    generateTimeSlots
} = require('../utils/bookingUtils');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[0-9+()\s-]{7,30}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const VALID_BOOKING_STATUSES = [
    'pending',
    'confirmed',
    'completed',
    'cancelled'
];

function getTodayLocal() {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function validDate(date) {
    if (!dateRegex.test(date || '')) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return false;
    }

    const [year, month, day] = date.split('-').map(Number);

    return (
        parsed.getFullYear() === year &&
        parsed.getMonth() + 1 === month &&
        parsed.getDate() === day
    );
}

/**
 * GET /api/bookings/availability
 *
 * Public availability check.
 */
async function getAvailability(req, res) {
    try {
        const {
            barber_id,
            service_id,
            date
        } = req.query;

        if (!barber_id || !service_id || !date) {
            return res.status(400).json({
                success: false,
                message: 'barber_id, service_id, and date are required query parameters.'
            });
        }

        const barberId = Number.parseInt(barber_id, 10);
        const serviceId = Number.parseInt(service_id, 10);

        if (
            !Number.isInteger(barberId) ||
            barberId < 1 ||
            !Number.isInteger(serviceId) ||
            serviceId < 1 ||
            !validDate(date)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please provide valid barber, service, and appointment date.'
            });
        }

        const todayStr = getTodayLocal();

        if (date < todayStr) {
            return res.status(400).json({
                success: false,
                message: 'Cannot check availability for past dates.'
            });
        }

        const dateObj = new Date(`${date}T00:00:00`);
        const dayOfWeek = dateObj.getDay();

        // 1. Verify barber
        const [barbers] = await pool.query(
            'SELECT id, status FROM barbers WHERE id = ?',
            [barberId]
        );

        if (
            !barbers.length ||
            barbers[0].status !== 'active'
        ) {
            return res.status(404).json({
                success: false,
                message: 'The selected barber is unavailable.'
            });
        }

        // 2. Verify service and get duration from database
        const [services] = await pool.query(
            'SELECT id, duration, status FROM services WHERE id = ?',
            [serviceId]
        );

        if (
            !services.length ||
            services[0].status !== 'active'
        ) {
            return res.status(404).json({
                success: false,
                message: 'The selected service is unavailable.'
            });
        }

        const durationMins = Number(services[0].duration);

        if (
            !Number.isInteger(durationMins) ||
            durationMins < 15 ||
            durationMins > 480
        ) {
            return res.status(400).json({
                success: false,
                message: 'The selected service has an invalid duration.'
            });
        }

        // 3. Fetch business hours
        const [bizHours] = await pool.query(
            `SELECT is_open, open_time, close_time
             FROM business_hours
             WHERE day_of_week = ?`,
            [dayOfWeek]
        );

        const businessHour = bizHours.length > 0
            ? bizHours[0]
            : {
                is_open: 1,
                open_time: '09:00:00',
                close_time: '20:00:00'
            };

        // 4. Fetch barber schedule
        const [barberScheds] = await pool.query(
            `SELECT is_working, start_time, end_time
             FROM barber_schedules
             WHERE barber_id = ?
               AND day_of_week = ?`,
            [barberId, dayOfWeek]
        );

        const barberSchedule = barberScheds.length > 0
            ? barberScheds[0]
            : {
                is_working: 1,
                start_time: '09:00:00',
                end_time: '18:00:00'
            };

        // 5. Fetch existing non-cancelled bookings
        const [existingBookings] = await pool.query(
            `SELECT start_time, end_time, status
             FROM bookings
             WHERE barber_id = ?
               AND booking_date = ?
               AND status != 'cancelled'`,
            [barberId, date]
        );

        // 6. Generate available slots
        const slots = generateTimeSlots(
            businessHour,
            barberSchedule,
            existingBookings,
            durationMins,
            date
        );

        return res.status(200).json({
            success: true,
            data: {
                barber_id: barberId,
                service_id: serviceId,
                date,
                duration: durationMins,
                day_of_week: dayOfWeek,
                is_barber_working: Boolean(barberSchedule.is_working),
                is_shop_open: Boolean(businessHour.is_open),
                slots
            }
        });

    } catch (err) {
        console.error('GetAvailability Error:', err);

        return res.status(500).json({
            success: false,
            message: 'Unable to calculate availability at this time.'
        });
    }
}

/**
 * POST /api/bookings
 *
 * Creates a booking for:
 * - Guest
 * - Authenticated customer
 * - Authenticated admin
 */
async function createBooking(req, res) {
    let connection;

    try {
        connection = await pool.getConnection();

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

        // Basic presence validation
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
                message: 'All required booking fields must be provided.'
            });
        }

        // Validate primitive types before regex/string operations
        if (
            typeof customer_name !== 'string' ||
            typeof customer_email !== 'string' ||
            typeof customer_phone !== 'string' ||
            typeof start_time !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please review the appointment information.'
            });
        }

        const normalizedName = customer_name.trim();
        const normalizedEmail = customer_email.toLowerCase().trim();
        const normalizedPhone = customer_phone.trim();

        if (
            !emailRegex.test(normalizedEmail) ||
            !phoneRegex.test(normalizedPhone)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address and phone number.'
            });
        }

        if (
            !validDate(booking_date) ||
            !timeRegex.test(start_time) ||
            normalizedName.length > 100 ||
            normalizedName.length < 2
        ) {
            return res.status(400).json({
                success: false,
                message: 'Please review the appointment date, time, and customer name.'
            });
        }

        // Validate date is today or future
        const todayStr = getTodayLocal();

        if (booking_date < todayStr) {
            return res.status(400).json({
                success: false,
                message: 'Appointments cannot be made in the past.'
            });
        }

        // Begin transaction for double-booking prevention
        await connection.beginTransaction();

        // 1. Fetch verified service price & duration
        const [services] = await connection.query(
            `SELECT id, name, price, duration, status
             FROM services
             WHERE id = ?`,
            [service_id]
        );

        if (
            services.length === 0 ||
            services[0].status !== 'active'
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'The selected service is invalid or currently unavailable.'
            });
        }

        const service = services[0];
        const verifiedDuration = Number(service.duration);
        const verifiedPrice = service.price;

        // 2. Fetch barber
        const [barbers] = await connection.query(
            `SELECT id, name, status
             FROM barbers
             WHERE id = ?`,
            [barber_id]
        );

        if (
            barbers.length === 0 ||
            barbers[0].status !== 'active'
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'The selected barber is invalid or inactive.'
            });
        }

        const barber = barbers[0];

        // Validate service duration from database
        if (
            !Number.isInteger(verifiedDuration) ||
            verifiedDuration < 15 ||
            verifiedDuration > 480
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'The selected service has an invalid duration.'
            });
        }

        // Format start time and calculate end time
        const formattedStartTime =
            start_time.length === 5
                ? `${start_time}:00`
                : start_time;

        const startMins = timeToMinutes(formattedStartTime);
        const endMins = startMins + verifiedDuration;
        const formattedEndTime = minutesToTime(endMins);

        if (
            !Number.isFinite(startMins) ||
            !Number.isFinite(endMins) ||
            endMins > 24 * 60
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'The selected appointment time is invalid.'
            });
        }

        const appointmentDay = new Date(
            `${booking_date}T00:00:00`
        ).getDay();

        // 3. Fetch business hours
        const [[businessHours]] = await connection.query(
            `SELECT is_open, open_time, close_time
             FROM business_hours
             WHERE day_of_week = ?
             FOR UPDATE`,
            [appointmentDay]
        );

        // 4. Fetch barber schedule
        const [[barberSchedule]] = await connection.query(
            `SELECT is_working, start_time, end_time
             FROM barber_schedules
             WHERE barber_id = ?
               AND day_of_week = ?
             FOR UPDATE`,
            [barber.id, appointmentDay]
        );

        if (
            !businessHours ||
            !barberSchedule ||
            !businessHours.is_open ||
            !barberSchedule.is_working
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'The shop or barber is unavailable on this date.'
            });
        }

        const earliestStart = Math.max(
            timeToMinutes(businessHours.open_time),
            timeToMinutes(barberSchedule.start_time)
        );

        const latestEnd = Math.min(
            timeToMinutes(businessHours.close_time),
            timeToMinutes(barberSchedule.end_time)
        );

        if (
            startMins < earliestStart ||
            endMins > latestEnd ||
            startMins % 30 !== 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'That appointment time is outside the available schedule.'
            });
        }

        // 5. Double-booking overlap check
        const [overlapping] = await connection.query(
            `SELECT id, booking_reference, start_time, end_time
             FROM bookings
             WHERE barber_id = ?
               AND booking_date = ?
               AND status != 'cancelled'
               AND start_time < ?
               AND end_time > ?
             FOR UPDATE`,
            [
                barber_id,
                booking_date,
                formattedEndTime,
                formattedStartTime
            ]
        );

        if (overlapping.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: 'This appointment time is no longer available.'
            });
        }

        // 6. Determine customer identity
        const reference = generateBookingReference(booking_date);

        let userId = null;
        let bookingName = normalizedName;
        let bookingEmail = normalizedEmail;
        let bookingPhone = normalizedPhone;

        if (req.user) {
            const [users] = await connection.query(
                `SELECT id, name, email, phone, role
                 FROM users
                 WHERE id = ?`,
                [req.user.id]
            );

            if (users.length === 0) {
                await connection.rollback();

                return res.status(401).json({
                    success: false,
                    message: 'Your account could not be verified. Please log in again.'
                });
            }

            const user = users[0];

            userId = user.id;
            bookingName = user.name;
            bookingEmail = user.email;
            bookingPhone = user.phone || '';

            if (!bookingPhone) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: 'Please add a phone number to your account before booking.'
                });
            }
        }

        // 7. Insert booking
        const [insertResult] = await connection.query(
            `INSERT INTO bookings
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
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
                    ? String(notes).trim().slice(0, 1000)
                    : null,
                payment_method || 'pay_at_shop'
            ]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Appointment reserved successfully.',
            data: {
                id: insertResult.insertId,
                booking_reference: reference,
                customer_name: bookingName,
                customer_email: bookingEmail,
                customer_phone: bookingPhone,
                service_name: service.name,
                barber_name: barber.name,
                booking_date,
                start_time: formattedStartTime,
                end_time: formattedEndTime,
                duration: verifiedDuration,
                total_price: verifiedPrice,
                status: 'pending',
                payment_method: payment_method || 'pay_at_shop'
            }
        });

    } catch (err) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Booking rollback error:', rollbackError);
            }
        }

        console.error('CreateBooking Error:', err);

        return res.status(500).json({
            success: false,
            message: 'Unable to create booking. Please try again.'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * GET /api/bookings/my
 *
 * Customer's own appointment history.
 */
async function getMyBookings(req, res) {
    try {
        const userId = req.user.id;

        const [rows] = await pool.query(
            `SELECT
                b.id,
                b.booking_reference,
                b.booking_date,
                b.start_time,
                b.end_time,
                b.total_price,
                b.status,
                b.notes,
                s.name AS service_name,
                s.duration,
                br.name AS barber_name
             FROM bookings b
             JOIN services s ON b.service_id = s.id
             JOIN barbers br ON b.barber_id = br.id
             WHERE b.user_id = ?
             ORDER BY b.booking_date DESC, b.start_time DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.error('GetMyBookings Error:', err);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve your appointments.'
        });
    }
}

/**
 * GET /api/bookings
 *
 * Admin-only booking list.
 */
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
            !VALID_BOOKING_STATUSES.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: `Invalid status filter. Status must be one of: ${VALID_BOOKING_STATUSES.join(', ')}.`
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
                b.created_at,
                s.name AS service_name,
                s.duration,
                br.name AS barber_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            JOIN barbers br ON b.barber_id = br.id
            WHERE 1=1
        `;

        const params = [];

        if (status && status !== 'all') {
            query += ' AND b.status = ?';
            params.push(status);
        }

        if (date) {
            if (!validDate(date)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid booking date filter.'
                });
            }

            query += ' AND b.booking_date = ?';
            params.push(date);
        }

        if (search) {
            const normalizedSearch = String(search).trim();

            if (normalizedSearch.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is too long.'
                });
            }

            if (normalizedSearch) {
                query += `
                    AND (
                        b.booking_reference LIKE ?
                        OR b.customer_name LIKE ?
                        OR b.customer_phone LIKE ?
                    )
                `;

                const term = `%${normalizedSearch}%`;

                params.push(
                    term,
                    term,
                    term
                );
            }
        }

        query += `
            ORDER BY b.booking_date DESC,
                     b.start_time DESC
        `;

        const [rows] = await pool.query(
            query,
            params
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (err) {
        console.error('GetAllBookings Error:', err);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve bookings list.'
        });
    }
}

/**
 * PATCH /api/bookings/:id
 *
 * Admin:
 * - Can update booking status.
 *
 * Customer:
 * - Can only cancel their own booking.
 */
async function updateBookingStatus(req, res) {
    try {
        const id = Number.parseInt(
            req.params.id,
            10
        );

        const { status } = req.body;

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID.'
            });
        }

        if (
            !status ||
            !VALID_BOOKING_STATUSES.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${VALID_BOOKING_STATUSES.join(', ')}`
            });
        }

        // Customer authorization
        if (req.user.role !== 'admin') {
            const [existing] = await pool.query(
                `SELECT
                    user_id,
                    customer_email,
                    status
                 FROM bookings
                 WHERE id = ?`,
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found.'
                });
            }

            const booking = existing[0];

            const isOwner =
                booking.user_id === req.user.id ||
                (
                    booking.user_id === null &&
                    booking.customer_email === req.user.email
                );

            if (!isOwner) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to modify this appointment.'
                });
            }

            if (status !== 'cancelled') {
                return res.status(403).json({
                    success: false,
                    message: 'Customers may only cancel appointments.'
                });
            }

            if (booking.status === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    message: 'This appointment is already cancelled.'
                });
            }
        }

        const [result] = await pool.query(
            `UPDATE bookings
             SET status = ?
             WHERE id = ?`,
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Booking status updated to ${status}.`
        });

    } catch (err) {
        console.error('UpdateBookingStatus Error:', err);

        return res.status(500).json({
            success: false,
            message: 'Unable to update booking status.'
        });
    }
}

module.exports = {
    getAvailability,
    createBooking,
    getMyBookings,
    getAllBookings,
    updateBookingStatus
};