// src/controllers/dashboardController.js
const { PrismaClient } = require('@prisma/client');
const attendanceService = require('../services/attendanceService');

const prisma = new PrismaClient();

// GET /dashboard
async function index(req, res) {
  try {
    const [visitsToday, totalActive, membersByPlan, recentLogs] = await Promise.all([
      attendanceService.todayVisits(),
      prisma.member.count({ where: { isActive: true } }),
      prisma.member.groupBy({
        by: ['planType'],
        _count: { planType: true },
        where: { isActive: true },
      }),
      prisma.attendanceLog.findMany({
        take: 8,
        orderBy: { checkIn: 'desc' },
        include: { member: true },
      }),
    ]);

    const planLabels = membersByPlan.map((p) => p.planType);
    const planCounts = membersByPlan.map((p) => p._count.planType);

    res.render('dashboard/index', {
      title: 'Dashboard — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      visitsToday,
      totalActive,
      planLabels: JSON.stringify(planLabels),
      planCounts: JSON.stringify(planCounts),
      recentLogs,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.flash('error', 'Failed to load dashboard data.');
    res.redirect('/auth/login');
  }
}

module.exports = { index };
