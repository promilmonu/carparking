'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const { BLOCKING_STATUSES } = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');
const ApiError = require('../utils/ApiError');
const { calculateTotalPrice } = require('./priceCalculator');
const { withSlotLock } = require('./slotLockService');

/**
 * Returns bookings for `parkingSlotId` that overlap [startTime, endTime).
 * Overlap rule: existing.start < new.end AND existing.end > new.start
 * (back-to-back bookings where existing.end == new.start are allowed).
 */
async function findOverlappingBookings(parkingSlotId, startTime, endTime, excludeBookingId) {
  const filter = {
    parkingSlotId,
    bookingStatus: { $in: BLOCKING_STATUSES },
    startTime: { $lt: new Date(endTime) },
    endTime: { $gt: new Date(startTime) },
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };
  return Booking.find(filter).select('bookingReference startTime endTime bookingStatus').lean();
}

/** True when the slot has no blocking booking overlapping the window. */
async function isSlotAvailable(parkingSlotId, startTime, endTime, excludeBookingId) {
  const conflicts = await findOverlappingBookings(parkingSlotId, startTime, endTime, excludeBookingId);
  return conflicts.length === 0;
}

/** Fetches all slots at a location that are free for the given window. */
async function findAvailableSlots({ parkingLocationId, vehicleType, startTime, endTime }) {
  const slotFilter = { parkingLocationId, isActive: true };
  if (vehicleType) slotFilter.vehicleType = vehicleType;

  const slots = await ParkingSlot.find(slotFilter).sort({ floor: 1, slotNumber: 1 }).lean();
  if (!slots.length) return [];

  const conflicts = await Booking.find({
    parkingSlotId: { $in: slots.map((s) => s._id) },
    bookingStatus: { $in: BLOCKING_STATUSES },
    startTime: { $lt: new Date(endTime) },
    endTime: { $gt: new Date(startTime) },
  })
    .select('parkingSlotId')
    .lean();

  const busy = new Set(conflicts.map((c) => String(c.parkingSlotId)));
  return slots.map((slot) => ({ ...slot, isAvailable: !busy.has(String(slot._id)) && slot.status !== 'maintenance' }));
}

function generateBookingReference() {
  return `PMS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

/**
 * Creates a booking with an atomic per-slot lock + conflict check, so two
 * concurrent requests can never double-book the same slot for an overlapping
 * period. Price is always computed on the backend.
 */
async function createBooking({ userId, body, currency = 'INR' }) {
  const { parkingLocationId, parkingSlotId, startTime, endTime, vehicleNumber, vehicleType, vehicleModel } = body;

  if (!mongoose.isValidObjectId(parkingLocationId)) throw ApiError.badRequest('Invalid parking location id');
  if (!mongoose.isValidObjectId(parkingSlotId)) throw ApiError.badRequest('Invalid parking slot id');

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) throw ApiError.badRequest('End time must be after start time');
  if (start.getTime() < Date.now() - 60 * 1000) {
    throw ApiError.badRequest('Start time cannot be in the past');
  }

  return withSlotLock(parkingSlotId, async () => {
    const location = await ParkingLocation.findById(parkingLocationId).lean();
    if (!location) throw ApiError.notFound('Parking location not found');
    if (!location.isActive) throw ApiError.badRequest('This parking location is inactive');

    const slot = await ParkingSlot.findOne({ _id: parkingSlotId, parkingLocationId }).lean();
    if (!slot) throw ApiError.notFound('Parking slot not found in this location');
    if (!slot.isActive || slot.status === 'maintenance') {
      throw ApiError.badRequest('This parking slot is not bookable');
    }
    if (slot.vehicleType !== vehicleType) {
      throw ApiError.badRequest(`Slot ${slot.slotNumber} does not support vehicle type "${vehicleType}"`);
    }

    const conflicts = await findOverlappingBookings(parkingSlotId, start, end);
    if (conflicts.length) {
      throw ApiError.conflict(
        `Slot ${slot.slotNumber} is already booked for the selected time period`
      );
    }

    const pricing = calculateTotalPrice({
      startTime: start,
      endTime: end,
      hourlyRate: location.hourlyRate,
      dailyRate: location.dailyRate,
    });

    const booking = await Booking.create({
      bookingReference: generateBookingReference(),
      userId,
      parkingLocationId,
      parkingSlotId,
      slotNumber: slot.slotNumber,
      vehicleNumber: String(vehicleNumber).toUpperCase(),
      vehicleType,
      vehicleModel: vehicleModel || '',
      startTime: start,
      endTime: end,
      totalAmount: pricing.totalAmount,
      currency,
      paymentStatus: 'pending',
      bookingStatus: 'pending',
    });

    await ParkingSlot.updateOne({ _id: parkingSlotId }, { $set: { status: 'reserved' } });

    return { booking, pricing, slot, location };
  });
}

/** Booking state machine - prevents invalid transitions. */
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled', 'no-show'],
  confirmed: ['checked-in', 'cancelled', 'no-show'],
  'checked-in': ['completed'],
  completed: [],
  cancelled: [],
  'no-show': [],
};

function assertTransition(from, to) {
  if (!ALLOWED_TRANSITIONS[from] || !ALLOWED_TRANSITIONS[from].includes(to)) {
    throw ApiError.badRequest(`Cannot change booking status from "${from}" to "${to}"`);
  }
}

/** Keeps the slot status in sync with booking state. */
async function syncSlotStatus(parkingSlotId, bookingStatus) {
  let status = 'available';
  if (bookingStatus === 'pending' || bookingStatus === 'confirmed') status = 'reserved';
  if (bookingStatus === 'checked-in') status = 'occupied';
  await ParkingSlot.updateOne({ _id: parkingSlotId }, { $set: { status } });
}

module.exports = {
  findOverlappingBookings,
  isSlotAvailable,
  findAvailableSlots,
  createBooking,
  assertTransition,
  syncSlotStatus,
  generateBookingReference,
  ALLOWED_TRANSITIONS,
};
