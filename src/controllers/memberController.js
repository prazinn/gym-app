// src/controllers/memberController.js
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { createUniqueMemberCode } = require('../utils/memberCode');
const qrService = require('../services/qrService');
const memberService = require('../services/memberService');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const memberValidators = [
  body('fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('phone').optional({ checkFalsy: true }).isMobilePhone().withMessage('Invalid phone number.'),
  body('heightCm').isFloat({ min: 50, max: 300 }).withMessage('Height must be between 50-300 cm.'),
  body('weightKg').isFloat({ min: 10, max: 500 }).withMessage('Weight must be between 10-500 kg.'),
  body('planType').trim().notEmpty().withMessage('Plan type is required.'),
  body('planStart').isISO8601().withMessage('Valid plan start date is required.'),
  body('planEnd').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid plan end date.'),
];

// GET /members
async function list(req, res) {
  try {
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;

    const where = {};
    
    // Search filter
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { memberCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Status filter
    if (status !== 'all') {
      where.status = status;
    }

    const [members, total, counts] = await Promise.all([
      prisma.member.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.member.count({ where }),
      memberService.getStatusCounts()
    ]);

    res.render('members/list', {
      title: 'Members — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      members,
      search,
      status,
      counts,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load members.');
    res.redirect('/dashboard');
  }
}

// GET /members/add
async function getAdd(req, res) {
  try {
    const plans = await prisma.plan.findMany({ 
      where: { isActive: true },
      orderBy: { planName: 'asc' } 
    });
    res.render('members/form', {
      title: 'Add Member — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      data: {},
      isEdit: false,
      member: null,
      plans,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load add member form.');
    res.redirect('/members');
  }
}

// POST /members/add
async function postAdd(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const plans = await prisma.plan.findMany({ orderBy: { planName: 'asc' } });
    return res.status(422).render('members/form', {
      title: 'Add Member — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: errors.array().map((e) => e.msg),
      data: req.body,
      isEdit: false,
      member: null,
      plans,
      csrfToken: req.csrfToken(),
    });
  }

  try {
    const memberCode = await createUniqueMemberCode();
    const member = await prisma.member.create({
      data: {
        memberCode,
        fullName: req.body.fullName.trim(),
        email: req.body.email.trim().toLowerCase(),
        phone: req.body.phone || null,
        heightCm: parseFloat(req.body.heightCm),
        weightKg: parseFloat(req.body.weightKg),
        planType: req.body.planType.trim(),
        planStart: new Date(req.body.planStart),
        planEnd: req.body.planEnd ? new Date(req.body.planEnd) : null,
        status: 'active'
      },
    });

    await qrService.generate(memberCode, member.id);

    // Initial status log
    await prisma.statusLog.create({
      data: {
        memberId: member.id,
        prevStatus: 'none',
        newStatus: 'active',
        remarks: 'New member registration.',
        changedBy: req.session.username || 'System'
      }
    });

    req.flash('success', `Member ${member.fullName} added with code ${memberCode}.`);
    res.redirect(`/members/${member.id}`);
  } catch (err) {
    console.error(err);
    const plans = await prisma.plan.findMany({ 
      where: { isActive: true },
      orderBy: { planName: 'asc' } 
    });
    const msg = err.code === 'P2002' ? 'Email already exists.' : 'Failed to create member.';
    return res.status(422).render('members/form', {
      title: 'Add Member — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: [msg],
      data: req.body,
      isEdit: false,
      member: null,
      plans,
      csrfToken: req.csrfToken(),
    });
  }
}

// GET /members/:id
async function profile(req, res) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        attendanceLogs: { orderBy: { checkIn: 'desc' }, take: 10 },
        statusLogs: { orderBy: { createdAt: 'desc' } }
      },
    });
    if (!member) {
      req.flash('error', 'Member not found.');
      return res.redirect('/members');
    }

    const plans = await prisma.plan.findMany({ where: { isActive: true } });

    res.render('members/profile', {
      title: `${member.fullName} — GymTrack`,
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      member,
      plans,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load member profile.');
    res.redirect('/members');
  }
}

// GET /members/:id/edit
async function getEdit(req, res) {
  try {
    const [member, plans] = await Promise.all([
      prisma.member.findUnique({ where: { id: parseInt(req.params.id) } }),
      prisma.plan.findMany({ 
        where: { isActive: true }, 
        orderBy: { planName: 'asc' } 
      }),
    ]);
    if (!member) { req.flash('error', 'Member not found.'); return res.redirect('/members'); }
    res.render('members/form', {
      title: 'Edit Member — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      data: member,
      isEdit: true,
      member,
      plans,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load member.');
    res.redirect('/members');
  }
}

// POST /members/:id/edit
async function postEdit(req, res) {
  const id = parseInt(req.params.id);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const [member, plans] = await Promise.all([
      prisma.member.findUnique({ where: { id } }),
      prisma.plan.findMany({ 
        where: { isActive: true }, 
        orderBy: { planName: 'asc' } 
      }),
    ]);
    return res.status(422).render('members/form', {
      title: 'Edit Member — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: errors.array().map((e) => e.msg),
      data: req.body,
      isEdit: true,
      member,
      plans,
      csrfToken: req.csrfToken(),
    });
  }

  try {
    await prisma.member.update({
      where: { id },
      data: {
        fullName: req.body.fullName.trim(),
        email: req.body.email.trim().toLowerCase(),
        phone: req.body.phone || null,
        heightCm: parseFloat(req.body.heightCm),
        weightKg: parseFloat(req.body.weightKg),
        planType: req.body.planType.trim(),
        planStart: new Date(req.body.planStart),
        planEnd: req.body.planEnd ? new Date(req.body.planEnd) : null,
      },
    });
    req.flash('success', 'Member updated successfully.');
    res.redirect(`/members/${id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to update member.');
    res.redirect(`/members/${id}/edit`);
  }
}

// POST /members/:id/status
async function postStatusChange(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { status, remarks } = req.body;

    if (!remarks) {
      req.flash('error', 'Remarks are mandatory for status changes.');
      return res.redirect(`/members/${id}`);
    }

    await memberService.changeStatus(
      id,
      status,
      remarks,
      req.session.username || 'Admin'
    );

    req.flash('success', `Member status updated to ${status}.`);
    res.redirect(`/members/${id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', err.message);
    res.redirect(`/members/${parseInt(req.params.id)}`);
  }
}

// POST /members/:id/renew
async function postRenew(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { planType, planEnd, remarks } = req.body;

    if (!remarks) {
      req.flash('error', 'Remarks are mandatory for renewals.');
      return res.redirect(`/members/${id}`);
    }

    const prevMember = await prisma.member.findUnique({ where: { id } });

    await prisma.member.update({
      where: { id },
      data: {
        planType,
        planEnd: new Date(planEnd),
        status: 'active'
      }
    });

    await prisma.statusLog.create({
      data: {
        memberId: id,
        prevStatus: prevMember.status,
        newStatus: 'active',
        remarks: `Subscription Renewed (${planType}). Remarks: ${remarks}`,
        changedBy: req.session.username || 'Admin'
      }
    });

    req.flash('success', 'Subscription renewed successfully.');
    res.redirect(`/members/${id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to renew subscription.');
    res.redirect(`/members/${parseInt(req.params.id)}`);
  }
}

// POST /members/:id/delete
async function deleteMember(req, res) {
  try {
    const id = parseInt(req.params.id);
    await prisma.statusLog.deleteMany({ where: { memberId: id } });
    await prisma.attendanceLog.deleteMany({ where: { memberId: id } });
    const member = await prisma.member.delete({ where: { id } });
    req.flash('success', 'Member deleted.');
    res.redirect('/members');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete member.');
    res.redirect('/members');
  }
}

// GET /members/:id/qr
async function downloadQr(req, res) {
  try {
    const member = await prisma.member.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!member || !member.qrCodePath) return res.status(404).send('QR code not found');
    
    const base64Data = member.qrCodePath.split(',')[1];
    const imgBuffer = Buffer.from(base64Data, 'base64');
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${member.memberCode}-qr.png"`);
    res.send(imgBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error downloading QR');
  }
}

// POST /members/:id/regen-qr
async function regenQr(req, res) {
  try {
    const member = await prisma.member.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    const newPath = await qrService.regenerate(member.id, member.memberCode);
    res.json({ success: true, path: newPath, memberCode: member.memberCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to regenerate QR code' });
  }
}

module.exports = {
  list, getAdd, postAdd, profile, getEdit, postEdit,
  postStatusChange, postRenew,
  deleteMember, downloadQr, regenQr, memberValidators,
};
