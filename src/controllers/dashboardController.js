// src/controllers/dashboardController.js
const { PrismaClient } = require('@prisma/client');
const attendanceService = require('../services/attendanceService');
const memberService = require('../services/memberService');

const prisma = new PrismaClient();

// GET /dashboard
async function index(req, res) {
  try {
    // 1. Auto-update expired members on every dashboard load
    await memberService.updateExpiredMembers();

    const [visitsToday, totalActive, membersByPlan, recentLogs, visitsLast7Days, expiringSoon] = await Promise.all([
      attendanceService.todayVisits(),
      prisma.member.count({ where: { status: 'active' } }),
      prisma.member.groupBy({
        by: ['planType'],
        _count: { planType: true },
        where: { status: 'active' },
      }),
      prisma.attendanceLog.findMany({
        take: 8,
        orderBy: { checkIn: 'desc' },
        include: { member: true },
      }),
      attendanceService.lastSevenDaysVisits(),
      memberService.getExpiringSoon(7), // Next 7 days
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
      visitsLast7Days,
      expiringSoon,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    req.flash('error', 'Failed to load dashboard data.');
    res.redirect('/auth/login');
  }
}

module.exports = { index };
