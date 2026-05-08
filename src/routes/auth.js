// src/routes/auth.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getLogin, postLogin, logout, loginValidators } = require('../controllers/authController');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again in a minute.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/login', getLogin);
router.post('/login', loginLimiter, loginValidators, postLogin);
router.get('/logout', logout);

module.exports = router;
