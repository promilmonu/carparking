'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, email: user.email }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

/** POST /api/auth/register - public registration (always role=customer). */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = new User({ name, email, phone, role: 'customer' });
  await user.setPassword(password);
  await user.save();

  return created(res, { token: signToken(user), user: user.toSafeJSON() });
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (!(await user.verifyPassword(password))) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.unauthorized('Your account has been deactivated. Contact an administrator.');

  return ok(res, { token: signToken(user), user: user.toSafeJSON() });
});

/** POST /api/auth/logout - JWTs are stateless; the client discards the token. */
const logout = asyncHandler(async (req, res) => ok(res, { message: 'Logged out successfully' }));

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => ok(res, req.user));

module.exports = { register, login, logout, me };
