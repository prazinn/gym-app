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
      const header = 'Log ID,Member Code,Full Name,Email,Plan,Check In,Check Out,Duration (min),Method,Logged By\n';
      const rows = logs.map((l) => {
        const duration = l.checkOut
          ? Math.round((new Date(l.checkOut) - new Date(l.checkIn)) / 60000)
          : '';
        return [
          l.id,
          l.member.memberCode,
          `"${l.member.fullName}"`,
          l.member.email,
          l.member.planType,
          new Date(l.checkIn).toISOString(),
          l.checkOut ? new Date(l.checkOut).toISOString() : '',
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

module.exports = { exportReport };
