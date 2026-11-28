'use strict';

// Authentication middleware must verify the session and populate req.user.
function requireAuthenticated(req, res, next) {
  if (!req.user || !req.user.id || req.user.is_active !== true) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Owner approval required' });
  }
  return next();
}

module.exports = { requireAuthenticated, requireOwner };
