// src/routes/plans.js
const express = require('express');
const { list, addPlan, updatePlan, deletePlan, planValidators } = require('../controllers/plansController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);
router.get('/',              list);
router.post('/add',         isAdmin, planValidators, addPlan);
router.post('/:id/edit',    isAdmin, planValidators, updatePlan);
router.post('/:id/delete',  isAdmin, deletePlan);

module.exports = router;
