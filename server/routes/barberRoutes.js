const express = require('express');
const router = express.Router();
const barberController = require('../controllers/barberController');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');

router.get('/', optionalToken, barberController.getAllBarbers);
router.get('/:id', barberController.getBarberById);
router.get('/:id/schedule', barberController.getBarberSchedule);
router.post('/', verifyToken, verifyAdmin, barberController.createBarber);
router.put('/:id', verifyToken, verifyAdmin, barberController.updateBarber);
router.put('/:id/schedule', verifyToken, verifyAdmin, barberController.updateBarberSchedule);
router.delete('/:id', verifyToken, verifyAdmin, barberController.deleteBarber);

module.exports = router;

