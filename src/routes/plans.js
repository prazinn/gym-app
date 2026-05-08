// src/routes/plans.js
const express = require('express');
const { list, addPlan, planValidators } = require('../controllers/plansController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.get('/',    list);
router.post('/add', isAdmin, planValidators, addPlan);

module.exports = router;
