const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');

// All admin routes require token and admin role
router.use(verifyToken, verifyAdmin);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/customers', adminController.getCustomers);
router.get('/settings/hours', adminController.getBusinessHours);
router.put('/settings/hours', adminController.updateBusinessHours);

module.exports = router;

