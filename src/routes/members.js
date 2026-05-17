// src/routes/members.js
const express = require('express');
const {
  list, getAdd, postAdd, profile, getEdit, postEdit,
  postStatusChange, postRenew,
  deleteMember, downloadQr, regenQr, memberValidators,
} = require('../controllers/memberController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(isAuthenticated);

router.get('/',           list);
router.get('/add',        getAdd);
router.post('/add',       memberValidators, postAdd);
router.get('/:id',        profile);
router.get('/:id/edit',   getEdit);
router.post('/:id/edit',  memberValidators, postEdit);
router.post('/:id/status', postStatusChange);
router.post('/:id/renew', postRenew);
router.post('/:id/delete', isAdmin, deleteMember);
router.get('/:id/qr',     downloadQr);
router.post('/:id/regen-qr', regenQr);

module.exports = router;
