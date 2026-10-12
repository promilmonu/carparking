'use strict';

const mongoose = require('mongoose');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { audit } = require('../services/auditService');
const { BLOCKING_STATUSES } = require('../models/Booking');

async function assertLocation(locationId) {
  if (!mongoose.isValidObjectId(locationId)) throw ApiError.badRequest('Invalid parking location id');
  const location = await ParkingLocation.findById(locationId);
  if (!location) throw ApiError.notFound('Parking location not found');
  return location;
}

async function syncCapacity(locationId) {
  const count = await ParkingSlot.countDocuments({ parkingLocationId: locationId, isActive: true });
  await ParkingLocation.updateOne(
    { _id: locationId, totalCapacity: { $lt: count } },
    { $set: { totalCapacity: count } }
  );
  return count;
}

/** POST /api/parking-locations/:locationId/slots
 *  Accepts a single slot, a bulk template ({count,startNumber,prefix,...}),
 *  or an explicit array via { slots: [...] }. */
const createSlots = asyncHandler(async (req, res) => {
  const location = await assertLocation(req.params.locationId);
  const body = req.body;

  let docs = [];
  if (Array.isArray(body.slots)) {
    docs = body.slots.map((s) => ({ ...s, parkingLocationId: location._id }));
  } else if (body.count) {
    const { count, startNumber, prefix, ...defaults } = body;
    for (let i = 0; i < count; i += 1) {
      docs.push({
        ...defaults,
        parkingLocationId: location._id,
        slotNumber: `${prefix || ''}${String(startNumber + i).padStart(2, '0')}`,
      });
    }
  } else {
    docs = [{ ...body, parkingLocationId: location._id }];
  }

  const existing = await ParkingSlot.find({
    parkingLocationId: location._id,
    slotNumber: { $in: docs.map((d) => d.slotNumber) },
  })
    .select('slotNumber')
    .lean();
  if (existing.length) {
    throw ApiError.conflict(
      `Slot number(s) already exist at this location: ${existing.map((e) => e.slotNumber).join(', ')}`
    );
  }

  const inserted = await ParkingSlot.insertMany(docs, { ordered: false });
  await syncCapacity(location._id);
  await audit(req, 'slot.create', 'ParkingSlot', location._id, { count: inserted.length });
  return created(res, inserted);
});

/** GET /api/parking-locations/:locationId/slots */
const listSlots = asyncHandler(async (req, res) => {
  const location = await assertLocation(req.params.locationId);
  const { status, vehicleType, floor, category, view } = req.query;
  const { page, limit, skip, sort } = getPagination(req.query, {
    defaultSortBy: 'slotNumber',
    defaultSortOrder: 'asc',
    allowedSortBy: ['slotNumber', 'floor', 'status', 'createdAt'],
    limit: 50,
  });

  const filter = { parkingLocationId: location._id };
  if (status) filter.status = status;
  if (vehicleType) filter.vehicleType = vehicleType;
  if (floor) filter.floor = floor;
  if (category) filter.category = category;

  if (view === 'grid') {
    const items = await ParkingSlot.find(filter).sort({ floor: 1, slotNumber: 1 }).lean();
    return ok(res, items, { total: items.length, view: 'grid' });
  }

  const [items, total] = await Promise.all([
    ParkingSlot.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ParkingSlot.countDocuments(filter),
  ]);
  return ok(res, items, buildMeta(total, page, limit));
});

/** GET /api/parking-slots/:id */
const getSlot = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid slot id');
  const slot = await ParkingSlot.findById(req.params.id).lean();
  if (!slot) throw ApiError.notFound('Parking slot not found');
  return ok(res, slot);
});

/** PUT /api/parking-slots/:id */
const updateSlot = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid slot id');
  const slot = await ParkingSlot.findById(req.params.id);
  if (!slot) throw ApiError.notFound('Parking slot not found');

  if (req.body.slotNumber && req.body.slotNumber !== slot.slotNumber) {
    const blocking = await Booking.countDocuments({
      parkingSlotId: slot._id,
      bookingStatus: { $in: BLOCKING_STATUSES },
    });
    if (blocking > 0) {
      throw ApiError.badRequest('Cannot rename a slot that has active bookings');
    }
    const dup = await ParkingSlot.findOne({
      parkingLocationId: slot.parkingLocationId,
      slotNumber: req.body.slotNumber,
      _id: { $ne: slot._id },
    });
    if (dup) throw ApiError.conflict(`Slot ${req.body.slotNumber} already exists at this location`);
  }

  // Deactivating a slot with active bookings would orphan them.
  if (req.body.isActive === false) {
    const blocking = await Booking.countDocuments({
      parkingSlotId: slot._id,
      bookingStatus: { $in: BLOCKING_STATUSES },
    });
    if (blocking > 0) throw ApiError.badRequest('Cannot deactivate a slot with active bookings');
  }

  Object.assign(slot, req.body);
  await slot.save();
  await syncCapacity(slot.parkingLocationId);
  await audit(req, 'slot.update', 'ParkingSlot', slot._id, { fields: Object.keys(req.body) });
  return ok(res, slot);
});

/** PATCH /api/parking-slots/:id/status */
const setStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid slot id');
  const slot = await ParkingSlot.findById(req.params.id);
  if (!slot) throw ApiError.notFound('Parking slot not found');

  if (req.body.status === 'maintenance') {
    const blocking = await Booking.countDocuments({
      parkingSlotId: slot._id,
      bookingStatus: { $in: BLOCKING_STATUSES },
    });
    if (blocking > 0) {
      throw ApiError.badRequest('Cannot send a slot to maintenance while it has active bookings');
    }
  }

  slot.status = req.body.status;
  if (req.body.status === 'maintenance') slot.isActive = false;
  if (req.body.status !== 'maintenance' && !slot.isActive) slot.isActive = true;
  await slot.save();
  await audit(req, 'slot.status', 'ParkingSlot', slot._id, { status: slot.status });
  return ok(res, slot);
});

module.exports = { createSlots, listSlots, getSlot, updateSlot, setStatus };
