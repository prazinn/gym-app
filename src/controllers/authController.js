// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');

const prisma = new PrismaClient();

// Validation rules for login
const loginValidators = [
  body('username').trim().notEmpty().withMessage('Username is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

// GET /auth/login
function getLogin(req, res) {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/login', {
    title: 'Login — GymTrack',
    errors: req.flash('error'),
    success: req.flash('success'),
    csrfToken: req.csrfToken(),
  });
}

// POST /auth/login
async function postLogin(req, res) {
  const { username, password } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
        isActive: true,
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/auth/login');
    }

    req.session.userId   = user.id;
    req.session.username = user.username;
    req.session.role     = user.role;

    req.flash('success', `Welcome back, ${user.username}!`);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Something went wrong. Please try again.');
    res.redirect('/auth/login');
  }
}

// GET /auth/logout
function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/auth/login');
  });
}

module.exports = { getLogin, postLogin, logout, loginValidators };
