'use strict';

const express = require('express');
const { authenticateSession, login, logout } = require('../authz-session');

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticateSession, (req, res) => {
  res.json({ user: req.user });
});
router.post('/logout', authenticateSession, logout);

module.exports = router;
