'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/** Strict rate limiting for authentication endpoints. */
const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

module.exports = { authLimiter };
