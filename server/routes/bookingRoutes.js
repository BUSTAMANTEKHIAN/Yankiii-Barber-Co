/**
 * Yankiii Barber Co. — Booking Routes
 *
 * Handles:
 * - Public availability
 * - Booking creation
 * - Customer booking history
 * - Admin booking management
 * - Customer cancellation
 */

'use strict';

const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const bookingController =
    require('../controllers/bookingController');

const {
    verifyToken,
    optionalToken
} = require('../middleware/authMiddleware');

const {
    verifyAdmin
} = require('../middleware/adminMiddleware');


/* =========================================================
   PUBLIC
========================================================= */

/**
 * GET /api/bookings/availability
 *
 * Public appointment availability.
 */
router.get(
    '/availability',
    bookingController.getAvailability
);

/**
 * GET /api/bookings/ref/:reference
 *
 * Public appointment confirmation lookup by booking reference code.
 */
router.get(
    '/ref/:reference',
    bookingController.getBookingByReference
);


/**
 * POST /api/bookings
 *
 * Allows:
 * - authenticated customers
 * - guests
 *
 * The frontend normally requires login,
 * but the API still supports guest bookings.
 *
 * Rate-limited to 30 attempts/hour per IP in production to prevent
 * booking spam without false-positive lockouts on shared NAT/proxies.
 * Disabled in development for seamless local testing.
 */
const bookingCreateLimiter = process.env.NODE_ENV === 'production'
    ? createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30, message: 'Too many booking attempts. Please try again in a few minutes.' })
    : (req, res, next) => next();

router.post(
    '/',
    bookingCreateLimiter,
    optionalToken,
    bookingController.createBooking
);


/* =========================================================
   CUSTOMER
========================================================= */

/**
 * GET /api/bookings/my
 *
 * Returns the authenticated customer's bookings.
 */
router.get(
    '/my',
    verifyToken,
    bookingController.getMyBookings
);


/**
 * PATCH /api/bookings/:id
 *
 * Customer:
 * - can only cancel their own appointment
 *
 * Admin:
 * - can update booking status
 */
router.patch(
    '/:id',
    verifyToken,
    bookingController.updateBookingStatus
);


/* =========================================================
   ADMIN
========================================================= */

/**
 * GET /api/bookings
 *
 * Admin-only booking management.
 */
router.get(
    '/',
    verifyToken,
    verifyAdmin,
    bookingController.getAllBookings
);


module.exports = router;