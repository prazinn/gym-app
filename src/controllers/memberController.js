// src/controllers/memberController.js
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { createUniqueMemberCode } = require('../utils/memberCode');
const qrService = require('../services/qrService');
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
    const status = req.query.status;
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;

    const where = {};
    
    // Search filter
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { memberCode: { contains: search } },
        { email: { contains: search } },
      ];
    }

    // Status filter
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.member.count({ where }),
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
    const plans = await prisma.plan.findMany({ orderBy: { planName: 'asc' } });
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
      },
    });

    await qrService.generate(memberCode, member.id);

    req.flash('success', `Member ${member.fullName} added with code ${memberCode}.`);
    res.redirect(`/members/${member.id}`);
  } catch (err) {
    console.error(err);
    const plans = await prisma.plan.findMany({ orderBy: { planName: 'asc' } });
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
        attendanceLogs: { orderBy: { checkIn: 'desc' }, take: 20 },
      },
    });
    if (!member) {
      req.flash('error', 'Member not found.');
      return res.redirect('/members');
    }
    res.render('members/profile', {
      title: `${member.fullName} — GymTrack`,
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      member,
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
      prisma.plan.findMany({ orderBy: { planName: 'asc' } }),
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
      prisma.plan.findMany({ orderBy: { planName: 'asc' } }),
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
        isActive: req.body.isActive === 'on' || req.body.isActive === 'true',
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

// POST /members/:id/delete
async function deleteMember(req, res) {
  try {
    const id = parseInt(req.params.id);
    await prisma.attendanceLog.deleteMany({ where: { memberId: id } });
    const member = await prisma.member.delete({ where: { id } });
    const qrPath = path.join(__dirname, '../../public/qr_codes', `${member.memberCode}.png`);
    if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
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
    if (!member) return res.status(404).send('Member not found');
    const filePath = qrService.getFilePath(member.memberCode);
    if (!fs.existsSync(filePath)) return res.status(404).send('QR code not found');
    res.download(filePath, `${member.memberCode}-qr.png`);
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
  deleteMember, downloadQr, regenQr, memberValidators,
};
