// src/services/memberService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class MemberService {
  /**
   * Check for expired subscriptions and update statuses automatically.
   * This should be called on app load and periodically.
   */
  async updateExpiredMembers() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active members whose plan has ended
    const membersToExpire = await prisma.member.findMany({
      where: {
        status: 'active',
        planEnd: {
          lt: today
        }
      }
    });

    if (membersToExpire.length === 0) return 0;

    // Bulk update to expired
    const result = await prisma.member.updateMany({
      where: {
        id: {
          in: membersToExpire.map(m => m.id)
        }
      },
      data: {
        status: 'expired'
      }
    });

    // Log the automatic transitions
    for (const member of membersToExpire) {
      await prisma.statusLog.create({
        data: {
          memberId: member.id,
          prevStatus: 'active',
          newStatus: 'expired',
          remarks: 'Automated transition: Subscription period ended.',
          changedBy: 'System'
        }
      });
    }

    return result.count;
  }

  /**
   * Manually change a member's status with mandatory remarks.
   */
  async changeStatus(memberId, newStatus, remarks, changedBy) {
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member) throw new Error('Member not found');

    const prevStatus = member.status;

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        status: newStatus,
        isActive: newStatus === 'active'
      }
    });

    await prisma.statusLog.create({
      data: {
        memberId,
        prevStatus,
        newStatus,
        remarks,
        changedBy
      }
    });

    return updatedMember;
  }

  /**
   * Get expiring members within a certain threshold of days.
   */
  async getExpiringSoon(daysThreshold = 7) {
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + daysThreshold);

    return await prisma.member.findMany({
      where: {
        status: 'active',
        planEnd: {
          gte: today,
          lte: thresholdDate
        }
      },
      orderBy: {
        planEnd: 'asc'
      }
    });
  }

  /**
   * Get status counts for badges.
   */
  async getStatusCounts() {
    const counts = await prisma.member.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    const result = {
      all: 0,
      active: 0,
      inactive: 0,
      expired: 0
    };

    counts.forEach(c => {
      result[c.status] = c._count.id;
      result.all += c._count.id;
    });

    return result;
  }
}

module.exports = new MemberService();
