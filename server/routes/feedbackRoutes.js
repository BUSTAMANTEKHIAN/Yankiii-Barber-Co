/**
 * Yankiii Barber Co. — Feedback & Reviews Routes
 */

'use strict';

const express = require('express');
const router = express.Router();

const feedbackController = require('../controllers/feedbackController');
const { verifyToken } = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');

const feedbackSubmitLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many feedback submissions. Please wait a few minutes.'
});

// Public: get approved feedback for homepage
router.get('/', feedbackController.getPublicFeedback);

// Customer: submit feedback for completed appointment
router.post('/', verifyToken, feedbackSubmitLimiter, feedbackController.createFeedback);

// Customer: get current customer's feedback history
router.get('/my', verifyToken, feedbackController.getMyFeedback);

// Admin: view all feedback
router.get('/admin', verifyToken, verifyAdmin, feedbackController.getAllFeedbackAdmin);

// Admin: update status (approve/hide)
router.patch('/admin/:id', verifyToken, verifyAdmin, feedbackController.updateFeedbackStatusAdmin);

// Admin: delete feedback
router.delete('/admin/:id', verifyToken, verifyAdmin, feedbackController.deleteFeedbackAdmin);

module.exports = router;

