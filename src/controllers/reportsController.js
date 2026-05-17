// src/controllers/reportsController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /reports/export?fmt=csv
async function exportReport(req, res) {
  const { fmt = 'csv', from, to } = req.query;

  const where = {};
  if (from || to) {
    where.checkIn = {};
    if (from) where.checkIn.gte = new Date(from);
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      where.checkIn.lte = t;
    }
  }

  try {
    const logs = await prisma.attendanceLog.findMany({
      where,
      include: { member: true },
      orderBy: { checkIn: 'desc' },
    });

    if (fmt === 'csv') {
      const formatDateNPT = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleString('en-GB', {
          timeZone: 'Asia/Kathmandu',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(',', '');
      };

      const header = 'Log ID,Member Code,Full Name,Email,Plan,Check In,Check Out,Duration (min),Method,Logged By\n';
      const rows = logs.map((l) => {
        const duration = l.checkOut
          ? Math.round((new Date(l.checkOut) - new Date(l.checkIn)) / 60000)
          : '';
        
        const checkInNPT = formatDateNPT(l.checkIn);
        const checkOutNPT = formatDateNPT(l.checkOut);

        return [
          l.id,
          l.member.memberCode,
          `"${l.member.fullName}"`,
          l.member.email,
          l.member.planType,
          checkInNPT,
          checkOutNPT,
          duration,
          l.method,
          l.loggedBy || '',
        ].join(',');
      });

      const csv = header + rows.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_report_${Date.now()}.csv"`);
      return res.send(csv);
    }

    res.status(400).send('Unsupported format. Use ?fmt=csv');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate report.');
  }
}

// GET /reports/subscriptions
async function subscriptionReport(req, res) {
  try {
    const [statusCounts, planStats, members] = await Promise.all([
      prisma.member.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.member.groupBy({
        by: ['planType'],
        _count: { id: true },
        where: { status: 'active' }
      }),
      prisma.member.findMany({
        where: { status: 'active', planEnd: { not: null } },
        select: { planEnd: true }
      })
    ]);

    // Format stats
    const stats = { active: 0, inactive: 0, expired: 0, total: 0 };
    statusCounts.forEach(c => {
      stats[c.status] = c._count.id;
      stats.total += c._count.id;
    });

    // Expiration trend (next 30 days)
    const today = new Date();
    const trend = Array(4).fill(0); // 4 weeks
    members.forEach(m => {
      const diff = new Date(m.planEnd) - today;
      const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
      if (weeks >= 0 && weeks < 4) trend[weeks]++;
    });

    res.render('reports/subscriptions', {
      title: 'Subscription Report — GymTrack',
      user: req.session.username,
      role: req.session.role,
      stats,
      planStats,
      trend: JSON.stringify(trend)
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to generate subscription report.');
    res.redirect('/dashboard');
  }
}

module.exports = { exportReport, subscriptionReport };
