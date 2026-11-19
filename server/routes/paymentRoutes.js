'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const paymentController = require('../controllers/paymentController');

router.post('/webhook', paymentController.mayaWebhook);
router.post('/bookings/:id/checkout', verifyToken, paymentController.createCheckoutRoute);
router.get('/status/:reference', verifyToken, paymentController.getPaymentStatus);

module.exports = router;
