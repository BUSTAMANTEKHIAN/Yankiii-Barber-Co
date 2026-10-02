'use strict';

const express = require('express');
const router = express.Router();
const { getBusinessHours } = require('../controllers/adminController');

router.get('/', getBusinessHours);

module.exports = router;
