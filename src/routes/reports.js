// src/routes/reports.js
const express = require('express');
const { exportReport } = require('../controllers/reportsController');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.get('/export', exportReport);

module.exports = router;
