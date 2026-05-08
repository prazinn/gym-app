// src/routes/attendance.js
const express = require('express');
const { scanPage, checkIn, checkOut, logs } = require('../controllers/attendanceController');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);

router.get('/scan',      scanPage);
router.post('/checkin',  checkIn);
router.post('/checkout', checkOut);
router.get('/logs',      logs);

module.exports = router;
