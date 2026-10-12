'use strict';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Verifies the JWT and loads the (active) user onto req.user. */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication token missing');

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  if (!mongoose.isValidObjectId(payload.sub)) {
    throw ApiError.unauthorized('Invalid token subject');
  }

  const user = await User.findById(payload.sub).select('+passwordHash').lean();
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.unauthorized('Account is deactivated');

  req.user = user;
  next();
});

/** Attaches req.user when a valid token is present, but never rejects. */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    if (mongoose.isValidObjectId(payload.sub)) {
      const user = await User.findById(payload.sub).lean();
      if (user && user.isActive) req.user = user;
    }
  } catch (err) {
    // ignore invalid tokens on public routes
  }
  next();
});

/** Role based access control: authorize('admin'), authorize('admin', 'customer') */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

module.exports = { authenticate, authorize, optionalAuthenticate };
