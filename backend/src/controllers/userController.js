'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { audit } = require('../services/auditService');

/** GET /api/users/me */
const getProfile = asyncHandler(async (req, res) => ok(res, req.user));

/** PATCH /api/users/me - update name/phone, optional password change. */
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  const { name, phone, currentPassword, newPassword } = req.body;

  if (newPassword) {
    if (!(await user.verifyPassword(currentPassword))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    await user.setPassword(newPassword);
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();
  return ok(res, user.toSafeJSON());
});

/** GET /api/admin/users - admin listing of customers/operators/admins. */
const listUsers = asyncHandler(async (req, res) => {
  const { role, isActive, search } = req.query;
  const { page, limit, skip, sort } = getPagination(req.query, {
    defaultSortBy: 'createdAt',
    allowedSortBy: ['createdAt', 'name', 'email', 'role'],
  });

  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive;
  if (search && String(search).trim()) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return ok(res, items.map(({ passwordHash, ...u }) => u), buildMeta(total, page, limit));
});

/** PATCH /api/admin/users/:id/status */
const updateUserStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid user id');
  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  await audit(req, 'user.status', 'User', user._id, { isActive: user.isActive });
  return ok(res, user.toSafeJSON());
});

/** PATCH /api/admin/users/:id/role */
const updateUserRole = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid user id');
  if (String(req.params.id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot change your own role');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { role: req.body.role } }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  await audit(req, 'user.role', 'User', user._id, { role: user.role });
  return ok(res, user.toSafeJSON());
});

module.exports = { getProfile, updateProfile, listUsers, updateUserStatus, updateUserRole };
