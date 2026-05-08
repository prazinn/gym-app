// src/controllers/plansController.js
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');

const prisma = new PrismaClient();

const planValidators = [
  body('planName').trim().notEmpty().withMessage('Plan name is required.'),
  body('durationDays').isInt({ min: 1 }).withMessage('Duration must be at least 1 day.'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number.'),
  body('features').optional({ checkFalsy: true }).trim(),
];

// GET /plans
async function list(req, res) {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
    res.render('plans/list', {
      title: 'Plans — GymTrack',
      user: req.session.username,
      role: req.session.role,
      errors: req.flash('error'),
      success: req.flash('success'),
      plans,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load plans.');
    res.redirect('/dashboard');
  }
}

// POST /plans/add
async function addPlan(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map((e) => e.msg).join(' '));
    return res.redirect('/plans');
  }
  try {
    await prisma.plan.create({
      data: {
        planName: req.body.planName.trim(),
        durationDays: parseInt(req.body.durationDays),
        price: parseFloat(req.body.price),
        features: req.body.features || null,
      },
    });
    req.flash('success', 'Plan created successfully.');
    res.redirect('/plans');
  } catch (err) {
    const msg = err.code === 'P2002' ? 'Plan name already exists.' : 'Failed to create plan.';
    req.flash('error', msg);
    res.redirect('/plans');
  }
}

module.exports = { list, addPlan, planValidators };
