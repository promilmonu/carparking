'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const bookingService = require('../services/bookingService');
const { audit } = require('../services/auditService');
const { BLOCKING_STATUSES } = require('../models/Booking');

function populateRefs() {
  return [
    { path: 'userId', select: 'name email phone' },
    { path: 'parkingLocationId', select: 'name code city address hourlyRate dailyRate' },
    { path: 'parkingSlotId', select: 'slotNumber floor category vehicleType' },
  ];
}

async function loadBooking(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid booking id');
  const booking = await Booking.findById(id).populate(populateRefs());
  if (!booking) throw ApiError.notFound('Booking not found');
  return booking;
}

function assertOwnerOrAdmin(booking, user) {
  const isOwner = String(booking.userId?._id || booking.userId) === String(user._id);
  if (!isOwner && !['admin', 'operator'].includes(user.role)) {
    throw ApiError.forbidden('You can only access your own bookings');
  }
  return isOwner;
}

/** POST /api/bookings - customers book a slot (conflict-free, backend priced). */
const createBooking = asyncHandler(async (req, res) => {
  const { booking, pricing } = await bookingService.createBooking({
    userId: req.user._id,
    body: req.body,
  });
  await audit(req, 'booking.create', 'Booking', booking._id, {
    reference: booking.bookingReference,
    slot: booking.slotNumber,
  });

  const populated = await Booking.findById(booking._id).populate(populateRefs());
  return created(res, { booking: populated, pricing });
});

/** GET /api/bookings - admin/operator: system-wide with filters. */
const listBookings = asyncHandler(async (req, res) => {
  const { bookingStatus, paymentStatus, locationId, userId, from, to, search } = req.query;
  const { page, limit, skip, sort } = getPagination(req.query, {
    defaultSortBy: 'createdAt',
    allowedSortBy: ['createdAt', 'startTime', 'endTime', 'totalAmount', 'bookingStatus'],
  });

  const filter = {};
  if (bookingStatus) filter.bookingStatus = bookingStatus;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (locationId && mongoose.isValidObjectId(locationId)) filter.parkingLocationId = locationId;
  if (userId && mongoose.isValidObjectId(userId)) filter.userId = userId;
  if (from || to) {
    filter.startTime = {};
    if (from) filter.startTime.$gte = new Date(from);
    if (to) filter.startTime.$lte = new Date(to);
  }
  if (search && String(search).trim()) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ bookingReference: rx }, { vehicleNumber: rx }];
  }

  const [items, total] = await Promise.all([
    Booking.find(filter).sort(sort).skip(skip).limit(limit).populate(populateRefs()),
    Booking.countDocuments(filter),
  ]);

  return ok(res, items, buildMeta(total, page, limit));
});

/** GET /api/bookings/:id */
const getBooking = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  assertOwnerOrAdmin(booking, req.user);
  return ok(res, booking);
});

/** GET /api/users/me/bookings */
const getMyBookings = asyncHandler(async (req, res) => {
  const { scope } = req.query;
  const { page, limit, skip, sort } = getPagination(req.query, {
    defaultSortBy: 'startTime',
    allowedSortBy: ['startTime', 'endTime', 'createdAt', 'totalAmount'],
  });

  const filter = { userId: req.user._id };
  if (scope === 'current') {
    filter.endTime = { $gte: new Date() };
    filter.bookingStatus = { $in: ['pending', 'confirmed', 'checked-in'] };
  } else if (scope === 'past') {
    filter.$or = [
      { endTime: { $lt: new Date() } },
      { bookingStatus: { $in: ['completed', 'cancelled', 'no-show'] } },
    ];
  }

  const [items, total] = await Promise.all([
    Booking.find(filter).sort(sort).skip(skip).limit(limit).populate(populateRefs()),
    Booking.countDocuments(filter),
  ]);

  return ok(res, items, buildMeta(total, page, limit));
});

/** PATCH /api/bookings/:id/confirm - simulated payment, pending -> confirmed. */
const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  const isOwner = assertOwnerOrAdmin(booking, req.user);
  if (!isOwner) throw ApiError.forbidden('Only the booking owner can confirm this booking');

  bookingService.assertTransition(booking.bookingStatus, 'confirmed');
  if (booking.paymentStatus !== 'paid') {
    const payment = await Payment.create({
      bookingId: booking._id,
      userId: req.user._id,
      amount: booking.totalAmount,
      currency: booking.currency,
      method: req.body.method || 'card',
      transactionId: `TXN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      status: 'paid',
    });
    booking.paymentStatus = 'paid';
    booking.paidAt = payment.paidAt;
  }
  booking.bookingStatus = 'confirmed';
  await booking.save();
  await bookingService.syncSlotStatus(booking.parkingSlotId, 'confirmed');
  await audit(req, 'booking.confirm', 'Booking', booking._id, { reference: booking.bookingReference });
  return ok(res, booking);
});

/** PATCH /api/bookings/:id/cancel - owner or admin; releases the slot. */
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  const isOwner = assertOwnerOrAdmin(booking, req.user);
  if (!isOwner && !['admin', 'operator'].includes(req.user.role)) {
    throw ApiError.forbidden('Not allowed');
  }

  bookingService.assertTransition(booking.bookingStatus, 'cancelled');
  booking.bookingStatus = 'cancelled';
  booking.cancelledAt = new Date();
  if (booking.paymentStatus === 'paid') {
    booking.paymentStatus = 'refunded';
    await Payment.updateOne({ bookingId: booking._id }, { $set: { status: 'refunded' } });
  }
  await booking.save();

  // Only free the slot when no other blocking booking still needs it.
  const otherBlocking = await Booking.countDocuments({
    parkingSlotId: booking.parkingSlotId,
    bookingStatus: { $in: BLOCKING_STATUSES },
  });
  if (otherBlocking === 0) await bookingService.syncSlotStatus(booking.parkingSlotId, 'cancelled');

  await audit(req, 'booking.cancel', 'Booking', booking._id, { reference: booking.bookingReference });
  return ok(res, booking);
});

/** PATCH /api/bookings/:id/check-in */
const checkIn = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  assertOwnerOrAdmin(booking, req.user);

  bookingService.assertTransition(booking.bookingStatus, 'checked-in');
  booking.bookingStatus = 'checked-in';
  booking.checkedInAt = new Date();
  await booking.save();
  await bookingService.syncSlotStatus(booking.parkingSlotId, 'checked-in');
  await audit(req, 'booking.check-in', 'Booking', booking._id, { reference: booking.bookingReference });
  return ok(res, booking);
});

/** PATCH /api/bookings/:id/check-out */
const checkOut = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  assertOwnerOrAdmin(booking, req.user);

  bookingService.assertTransition(booking.bookingStatus, 'completed');
  booking.bookingStatus = 'completed';
  booking.checkedOutAt = new Date();
  await booking.save();
  await bookingService.syncSlotStatus(booking.parkingSlotId, 'completed');
  await audit(req, 'booking.check-out', 'Booking', booking._id, { reference: booking.bookingReference });
  return ok(res, booking);
});

module.exports = {
  createBooking,
  listBookings,
  getBooking,
  getMyBookings,
  confirmBooking,
  cancelBooking,
  checkIn,
  checkOut,
};
