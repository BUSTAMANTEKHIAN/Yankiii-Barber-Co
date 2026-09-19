const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');

router.get('/', optionalToken, serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', verifyToken, verifyAdmin, serviceController.createService);
router.put('/:id', verifyToken, verifyAdmin, serviceController.updateService);
router.delete('/:id', verifyToken, verifyAdmin, serviceController.deleteService);

module.exports = router;

