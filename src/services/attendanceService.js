// src/services/attendanceService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Check in a member by memberCode.
 * Prevents duplicate open check-ins.
 * @param {string} memberCode
 * @param {string} loggedBy  username of staff
 * @param {string} method    'qr_scan' | 'manual'
 * @returns {{ log, member }}
 */
async function checkIn(memberCode, loggedBy = 'system', method = 'qr_scan') {
  const member = await prisma.member.findUnique({ where: { memberCode } });
  if (!member) throw new Error(`Member not found: ${memberCode}`);
  if (!member.isActive) throw new Error(`Member account is inactive.`);

  // Check for an existing open session
  const open = await prisma.attendanceLog.findFirst({
    where: { memberId: member.id, checkOut: null },
    orderBy: { checkIn: 'desc' },
  });
  if (open) throw new Error(`Member already checked in (log #${open.id}). Please check out first.`);

  const log = await prisma.attendanceLog.create({
    data: {
      memberId: member.id,
      loggedBy,
      method,
    },
  });

  return { log, member };
}

/**
 * Check out a member by memberCode (closes most-recent open log).
 * @param {string} memberCode
 * @returns {{ log, member }}
 */
async function checkOut(memberCode) {
  const member = await prisma.member.findUnique({ where: { memberCode } });
  if (!member) throw new Error(`Member not found: ${memberCode}`);

  const open = await prisma.attendanceLog.findFirst({
    where: { memberId: member.id, checkOut: null },
    orderBy: { checkIn: 'desc' },
  });
  if (!open) throw new Error(`No open check-in found for this member.`);

  const log = await prisma.attendanceLog.update({
    where: { id: open.id },
    data: { checkOut: new Date() },
  });

  return { log, member };
}

/**
 * Get paginated attendance logs with optional date range filter.
 */
async function getLogs({ page = 1, limit = 20, from, to, search } = {}) {
  const skip = (page - 1) * limit;
  const where = {};

  if (from || to) {
    where.checkIn = {};
    if (from) where.checkIn.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.checkIn.lte = toDate;
    }
  }

  if (search) {
    where.member = {
      OR: [
        { fullName: { contains: search } },
        { memberCode: { contains: search } },
      ],
    };
  }

  const [logs, total] = await Promise.all([
    prisma.attendanceLog.findMany({
      where,
      include: { member: true },
      orderBy: { checkIn: 'desc' },
      skip,
      take: limit,
    }),
    prisma.attendanceLog.count({ where }),
  ]);

  return { logs, total, page, limit, pages: Math.ceil(total / limit) };
}

/**
 * Get today's visit count.
 */
async function todayVisits() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return prisma.attendanceLog.count({
    where: { checkIn: { gte: start, lte: end } },
  });
}

module.exports = { checkIn, checkOut, getLogs, todayVisits };
