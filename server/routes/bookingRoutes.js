const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');

// Public availability check
router.get('/availability', bookingController.getAvailability);

// Create appointment (Customer or Guest)
router.post('/', optionalToken, bookingController.createBooking);

// Customer's own appointment history
router.get('/my', verifyToken, bookingController.getMyBookings);

// Admin: list all bookings with filters
router.get('/', verifyToken, verifyAdmin, bookingController.getAllBookings);

// Update status (Admin or Customer cancel)
router.patch('/:id', verifyToken, bookingController.updateBookingStatus);

module.exports = router;

