'use strict';

const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');

/** GET /api/payments - admin sees all, customers see their own. */
const listPayments = asyncHandler(async (req, res) => {
  const { status, method, search } = req.query;
  const { page, limit, skip, sort } = getPagination(req.query, {
    defaultSortBy: 'createdAt',
    allowedSortBy: ['createdAt', 'amount', 'status'],
  });

  const filter = {};
  if (req.user.role !== 'admin') filter.userId = req.user._id;
  if (status) filter.status = status;
  if (method) filter.method = method;
  if (search && String(search).trim()) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.transactionId = rx;
  }

  const [items, total] = await Promise.all([
    Payment.find(filter).sort(sort).skip(skip).limit(limit)
      .populate('bookingId', 'bookingReference slotNumber startTime endTime')
      .populate('userId', 'name email')
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return ok(res, items, buildMeta(total, page, limit));
});

/** GET /api/payments/:id */
const getPayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid payment id');
  const payment = await Payment.findById(req.params.id)
    .populate('bookingId', 'bookingReference slotNumber startTime endTime bookingStatus')
    .populate('userId', 'name email');
  if (!payment) throw ApiError.notFound('Payment not found');
  if (req.user.role !== 'admin' && String(payment.userId?._id || payment.userId) !== String(req.user._id)) {
    throw ApiError.forbidden('Not your payment');
  }
  return ok(res, payment);
});

module.exports = { listPayments, getPayment };
