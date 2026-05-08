// src/middleware/validate.js
const { validationResult } = require('express-validator');

/**
 * Runs express-validator results; on errors, re-renders the given view
 * with flash-style error messages and the original body data.
 */
function handleValidation(view, extraLocals = {}) {
  return (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map((e) => e.msg);
      return res.status(422).render(view, {
        title: extraLocals.title || 'Error',
        errors: messages,
        data: req.body,
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        user: req.session.username || null,
        role: req.session.role || null,
        ...extraLocals,
      });
    }
    next();
  };
}

module.exports = { handleValidation };
