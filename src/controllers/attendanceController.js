// src/controllers/attendanceController.js
const attendanceService = require('../services/attendanceService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /attendance/scan
function scanPage(req, res) {
  res.render('attendance/scan', {
    title: 'Scan QR — GymTrack',
    user: req.session.username,
    role: req.session.role,
    errors: [],
    success: [],
    csrfToken: req.csrfToken(),
  });
}

// POST /attendance/checkin  (JSON)
async function checkIn(req, res) {
  const { memberCode } = req.body;
  if (!memberCode) return res.status(400).json({ error: 'memberCode is required.' });
  try {
    const { log, member } = await attendanceService.checkIn(
      memberCode.trim(),
      req.session.username || 'staff',
      'qr_scan'
    );
    res.json({
      success: true,
      message: `Welcome, ${member.fullName}! Checked in at ${new Date(log.checkIn).toLocaleTimeString()}.`,
      log,
      member: { fullName: member.fullName, memberCode: member.memberCode },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// POST /attendance/checkout  (JSON)
async function checkOut(req, res) {
  const { memberCode } = req.body;
  if (!memberCode) return res.status(400).json({ error: 'memberCode is required.' });
  try {
    const { log, member } = await attendanceService.checkOut(memberCode.trim());
    const duration = Math.round((new Date(log.checkOut) - new Date(log.checkIn)) / 60000);
    res.json({
      success: true,
      message: `Goodbye, ${member.fullName}! Duration: ${duration} min.`,
      log,
      member: { fullName: member.fullName, memberCode: member.memberCode },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /attendance/logs
async function logs(req, res) {
  try {
    const { page = 1, from, to, search } = req.query;
    const result = await attendanceService.getLogs({
      page: parseInt(page),
      limit: 20,
      from,
      to,
      search,
    });
    res.render('attendance/logs', {
      title: 'Attendance Logs — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      ...result,
      filters: { from, to, search },
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load logs.');
    res.redirect('/dashboard');
  }
}

module.exports = { scanPage, checkIn, checkOut, logs };
