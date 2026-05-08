// src/app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const ejsMate = require('ejs-mate');
const config = require('./config');

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const memberRoutes = require('./routes/members');
const attendanceRoutes = require('./routes/attendance');
const reportsRoutes = require('./routes/reports');
const plansRoutes = require('./routes/plans');

const { isAuthenticated } = require('./middleware/auth');

const { PrismaClient } = require('@prisma/client');
const { PrismaSessionStore } = require('@quixo3/prisma-session-store');

const app = express();

// Trust proxy for Vercel
app.set('trust proxy', 1);

// ─── View Engine ─────────────────────────────────────────────────────────────
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", 'blob:'],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
  })
);

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.isProd,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
    store: new PrismaSessionStore(
      new PrismaClient(),
      {
        checkPeriod: 2 * 60 * 1000,  // ms
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }
    ),
  })
);

// ─── Flash Messages ───────────────────────────────────────────────────────────
app.use(flash());

// ─── CSRF ─────────────────────────────────────────────────────────────────────
const csrfProtection = csurf({ cookie: false });
app.use(csrfProtection);

// Make csrfToken & session user available to all views automatically
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  res.locals.user = req.session.username || null;
  res.locals.role = req.session.role || null;
  res.locals.errors = req.flash('error');
  res.locals.success = req.flash('success');
  next();
});

// ─── Static Files ─────────────────────────────────────────────────────────────
// Protect /qr_codes — only authenticated users
app.use('/qr_codes', isAuthenticated, express.static(path.join(__dirname, '../public/qr_codes')));
// Everything else in public is open
app.use(express.static(path.join(__dirname, '../public')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', time: new Date().toISOString() }));
app.get('/', (req, res) => res.redirect('/dashboard'));
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/members', memberRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/reports', reportsRoutes);
app.use('/plans', plansRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Page Not Found — GymTrack',
    user: req.session.username || null,
    role: req.session.role || null,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // CSRF token errors
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('errors/403', {
      title: 'Invalid CSRF Token',
      user: req.session.username || null,
      role: req.session.role || null,
    });
  }
  console.error('Unhandled error:', err);
  res.status(500).render('errors/500', {
    title: 'Server Error — GymTrack',
    user: req.session.username || null,
    role: req.session.role || null,
    message: config.isProd ? 'An unexpected error occurred.' : err.message,
  });
});

module.exports = app;
