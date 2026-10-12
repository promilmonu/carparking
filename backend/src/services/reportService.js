'use strict';

const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const User = require('../models/User');
const Payment = require('../models/Payment');

const ACTIVE_STATUSES = ['pending', 'confirmed', 'checked-in'];

/** Aggregated numbers for the admin dashboard. */
async function getDashboardStats() {
  const [totalLocations, activeLocations, totalSlots, slotAgg, activeBookings, todayRevenueAgg, totalUsers] =
    await Promise.all([
      ParkingLocation.countDocuments(),
      ParkingLocation.countDocuments({ isActive: true }),
      ParkingSlot.countDocuments({ isActive: true }),
      ParkingSlot.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.countDocuments({ bookingStatus: { $in: ACTIVE_STATUSES } }),
      Booking.aggregate([
        {
          $match: {
            paymentStatus: 'paid',
            createdAt: { $gte: new Date(startOfToday()), $lt: new Date(startOfToday() + 24 * 3600 * 1000) },
          },
        },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: 'customer' }),
    ]);

  const byStatus = Object.fromEntries(slotAgg.map((s) => [s._id, s.count]));
  const occupiedSlots = byStatus.occupied || 0;
  const reservedSlots = byStatus.reserved || 0;
  const maintenanceSlots = byStatus.maintenance || 0;
  const availableSlots = Math.max(0, totalSlots - occupiedSlots - reservedSlots - maintenanceSlots);

  return {
    totalLocations,
    activeLocations,
    totalSlots,
    availableSlots,
    occupiedSlots,
    reservedSlots,
    maintenanceSlots,
    activeBookings,
    totalCustomers: totalUsers,
    todayRevenue: todayRevenueAgg[0]?.revenue || 0,
    todayBookings: todayRevenueAgg[0]?.count || 0,
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Occupancy percentage per day for the last `days` days. */
async function getOccupancyReport({ days = 7, parkingLocationId } = {}) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (Number(days) - 1));

  const match = { startTime: { $gte: since }, bookingStatus: { $in: ACTIVE_STATUSES.concat(['completed']) } };
  if (parkingLocationId && mongoose.isValidObjectId(parkingLocationId)) {
    match.parkingLocationId = new mongoose.Types.ObjectId(parkingLocationId);
  }

  const [bookingsPerDay, capacityPerLocation] = await Promise.all([
    Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          bookings: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ParkingSlot.aggregate([
      ...(parkingLocationId && mongoose.isValidObjectId(parkingLocationId)
        ? [{ $match: { parkingLocationId: new mongoose.Types.ObjectId(parkingLocationId) } }]
        : []),
      { $match: { isActive: true } },
      { $group: { _id: '$parkingLocationId', capacity: { $sum: 1 } } },
    ]),
  ]);

  const totalCapacity = capacityPerLocation.reduce((sum, l) => sum + l.capacity, 0) || 1;
  const daysOut = [];
  for (let i = 0; i < Number(days); i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = bookingsPerDay.find((b) => b._id === key);
    daysOut.push({
      date: key,
      bookings: row?.bookings || 0,
      revenue: row?.revenue || 0,
      occupancyPercent: Math.min(100, Math.round(((row?.bookings || 0) / totalCapacity) * 1000) / 10),
    });
  }
  return { capacity: totalCapacity, days: daysOut };
}

/** Revenue grouped per day between two dates. */
async function getRevenueReport({ from, to, parkingLocationId } = {}) {
  const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const endDate = to ? new Date(to) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const match = {
    paymentStatus: 'paid',
    createdAt: { $gte: startDate, $lte: endDate },
  };
  if (parkingLocationId && mongoose.isValidObjectId(parkingLocationId)) {
    match.parkingLocationId = new mongoose.Types.ObjectId(parkingLocationId);
  }

  const [perDay, perLocation, totals] = await Promise.all([
    Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          payments: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$parkingLocationId',
          revenue: { $sum: '$totalAmount' },
          payments: { $sum: 1 },
        },
      },
      { $lookup: { from: 'parkinglocations', localField: '_id', foreignField: '_id', as: 'location' } },
      { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          locationId: '$_id',
          locationName: '$location.name',
          revenue: 1,
          payments: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Booking.aggregate([
      { $match: match },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalPayments: { $sum: 1 } } },
    ]),
  ]);

  return {
    range: { from: startDate, to: endDate },
    totalRevenue: totals[0]?.totalRevenue || 0,
    totalPayments: totals[0]?.totalPayments || 0,
    perDay: perDay.map((r) => ({ date: r._id, revenue: r.revenue, payments: r.payments })),
    perLocation,
  };
}

module.exports = { getDashboardStats, getOccupancyReport, getRevenueReport, ACTIVE_STATUSES, Payment };
