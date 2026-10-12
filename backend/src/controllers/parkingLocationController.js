'use strict';

const mongoose = require('mongoose');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildMeta } = require('../utils/pagination');
const { audit } = require('../services/auditService');
const bookingService = require('../services/bookingService');
const { BLOCKING_STATUSES } = require('../models/Booking');

async function slotStats(locationIds) {
  const agg = await ParkingSlot.aggregate([
    { $match: { parkingLocationId: { $in: locationIds }, isActive: true } },
    { $group: { _id: { loc: '$parkingLocationId', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const stats = new Map();
  for (const row of agg) {
    const key = String(row._id.loc);
    if (!stats.has(key)) stats.set(key, { totalSlots: 0, availableSlots: 0, occupiedSlots: 0, reservedSlots: 0, maintenanceSlots: 0 });
    const s = stats.get(key);
    s.totalSlots += row.count;
    if (row._id.status === 'available') s.availableSlots += row.count;
    if (row._id.status === 'occupied') s.occupiedSlots += row.count;
    if (row._id.status === 'reserved') s.reservedSlots += row.count;
    if (row._id.status === 'maintenance') s.maintenanceSlots += row.count;
  }
  return stats;
}

/** POST /api/parking-locations (admin) */
const createLocation = asyncHandler(async (req, res) => {
  const exists = await ParkingLocation.findOne({ code: req.body.code });
  if (exists) throw ApiError.conflict(`A location with code "${req.body.code}" already exists`);

  const location = await ParkingLocation.create({ ...req.body, createdBy: req.user._id });
  await audit(req, 'location.create', 'ParkingLocation', location._id, { code: location.code });
  return created(res, location);
});

/** GET /api/parking-locations - public/customers see only active ones. */
const listLocations = asyncHandler(async (req, res) => {
  const { search, city, parkingType, vehicleType, facility, minPrice, maxPrice, isActive } = req.query;
  const { page, limit, skip, sort } = getPagination(req.query, {
    defaultSortBy: 'name',
    allowedSortBy: ['name', 'city', 'hourlyRate', 'dailyRate', 'createdAt', 'totalCapacity'],
  });

  const filter = {};
  const isAdmin = req.user?.role === 'admin';
  if (isActive !== undefined) filter.isActive = isActive;
  else if (!isAdmin) filter.isActive = true;
  if (city) filter.city = new RegExp(city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (parkingType) filter.parkingType = parkingType;
  if (vehicleType) filter.supportedVehicleTypes = vehicleType;
  if (facility) filter.facilities = facility;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.hourlyRate = {};
    if (minPrice !== undefined) filter.hourlyRate.$gte = Number(minPrice);
    if (maxPrice !== undefined) filter.hourlyRate.$lte = Number(maxPrice);
  }
  if (search && String(search).trim()) {
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { city: rx }, { address: rx }, { code: rx }];
  }

  const [items, total] = await Promise.all([
    ParkingLocation.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ParkingLocation.countDocuments(filter),
  ]);

  const stats = await slotStats(items.map((i) => i._id));
  const data = items.map((i) => ({ ...i, ...(stats.get(String(i._id)) || { totalSlots: 0, availableSlots: 0 }) }));

  return ok(res, data, buildMeta(total, page, limit));
});

/** GET /api/parking-locations/:id */
const getLocation = asyncHandler(async (req, res) => {
  const location = await ParkingLocation.findById(req.params.id).lean();
  if (!location) throw ApiError.notFound('Parking location not found');

  const statsMap = await slotStats([location._id]);
  const stats = statsMap.get(String(location._id));
  const floors = await ParkingSlot.distinct('floor', { parkingLocationId: location._id, isActive: true });

  return ok(res, {
    ...location,
    ...(stats || { totalSlots: 0, availableSlots: 0, occupiedSlots: 0, reservedSlots: 0, maintenanceSlots: 0 }),
    floors: floors.sort(),
  });
});

/** GET /api/parking-locations/:locationId/available-slots?vehicleType&startTime&endTime */
const availableSlots = asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  if (!mongoose.isValidObjectId(locationId)) throw ApiError.badRequest('Invalid parking location id');

  const location = await ParkingLocation.findById(locationId).lean();
  if (!location) throw ApiError.notFound('Parking location not found');

  const { vehicleType, startTime, endTime } = req.query;
  const slots = await bookingService.findAvailableSlots({
    parkingLocationId: locationId,
    vehicleType,
    startTime,
    endTime,
  });

  return ok(res, {
    location: { id: location._id, name: location.name, hourlyRate: location.hourlyRate, dailyRate: location.dailyRate },
    slots,
  });
});

/** PUT /api/parking-locations/:id (admin) */
const updateLocation = asyncHandler(async (req, res) => {
  const location = await ParkingLocation.findById(req.params.id);
  if (!location) throw ApiError.notFound('Parking location not found');

  if (req.body.code && req.body.code !== location.code) {
    const dup = await ParkingLocation.findOne({ code: req.body.code, _id: { $ne: location._id } });
    if (dup) throw ApiError.conflict(`A location with code "${req.body.code}" already exists`);
  }

  // Never allow shrinking capacity below slots that are actually in use.
  if (req.body.totalCapacity !== undefined && req.body.totalCapacity < location.totalCapacity) {
    const blocking = await Booking.countDocuments({
      parkingLocationId: location._id,
      bookingStatus: { $in: BLOCKING_STATUSES },
    });
    const activeSlots = await ParkingSlot.countDocuments({ parkingLocationId: location._id, isActive: true });
    const minAllowed = Math.max(blocking, 0);
    if (req.body.totalCapacity < minAllowed) {
      throw ApiError.badRequest(
        `Cannot reduce capacity to ${req.body.totalCapacity}: ${blocking} active booking(s) depend on this location`
      );
    }
    if (req.body.totalCapacity < activeSlots) {
      throw ApiError.badRequest(
        `Cannot reduce capacity to ${req.body.totalCapacity}: ${activeSlots} slot(s) are configured. Remove slots first.`
      );
    }
  }

  Object.assign(location, req.body);
  await location.save();
  await audit(req, 'location.update', 'ParkingLocation', location._id, { fields: Object.keys(req.body) });
  return ok(res, location);
});

/** PATCH /api/parking-locations/:id/status */
const setStatus = asyncHandler(async (req, res) => {
  const location = await ParkingLocation.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: req.body.isActive } },
    { new: true }
  );
  if (!location) throw ApiError.notFound('Parking location not found');
  await audit(req, 'location.status', 'ParkingLocation', location._id, { isActive: location.isActive });
  return ok(res, location);
});

/** DELETE /api/parking-locations/:id - only when no dependent bookings exist. */
const deleteLocation = asyncHandler(async (req, res) => {
  const location = await ParkingLocation.findById(req.params.id);
  if (!location) throw ApiError.notFound('Parking location not found');

  const activeBookings = await Booking.countDocuments({
    parkingLocationId: location._id,
    bookingStatus: { $in: BLOCKING_STATUSES },
  });
  if (activeBookings > 0) {
    throw ApiError.conflict(
      `Cannot delete "${location.name}": ${activeBookings} active booking(s) reference this location. Deactivate it instead.`
    );
  }

  await ParkingSlot.deleteMany({ parkingLocationId: location._id });
  await location.deleteOne();
  await audit(req, 'location.delete', 'ParkingLocation', req.params.id, { name: location.name });
  return ok(res, { message: 'Parking location deleted' });
});

module.exports = {
  createLocation,
  listLocations,
  getLocation,
  availableSlots,
  updateLocation,
  setStatus,
  deleteLocation,
};
