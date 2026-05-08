// src/middleware/auth.js

/**
 * Redirect to login if not authenticated.
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.flash('error', 'Please log in to continue.');
  return res.redirect('/auth/login');
}

/**
 * Allow only admin users; respond 403 otherwise.
 */
function isAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).render('errors/403', {
    title: 'Forbidden',
    user: req.session.username || null,
  });
}

module.exports = { isAuthenticated, isAdmin };
