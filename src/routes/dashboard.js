// src/routes/dashboard.js
const express = require('express');
const { index } = require('../controllers/dashboardController');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.get('/', isAuthenticated, index);

module.exports = router;
