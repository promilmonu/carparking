'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const reportService = require('../services/reportService');
const AuditLog = require('../models/AuditLog');
const { getPagination, buildMeta } = require('../utils/pagination');

/** GET /api/admin/dashboard */
const dashboard = asyncHandler(async (req, res) => {
  const [stats, occupancy] = await Promise.all([
    reportService.getDashboardStats(),
    reportService.getOccupancyReport({ days: 7 }),
  ]);
  return ok(res, { ...stats, occupancy });
});

/** GET /api/admin/reports/occupancy?days=7&locationId=... */
const occupancyReport = asyncHandler(async (req, res) => {
  const report = await reportService.getOccupancyReport({
    days: req.query.days || 7,
    parkingLocationId: req.query.locationId,
  });
  return ok(res, report);
});

/** GET /api/admin/reports/revenue?from&to&locationId=... */
const revenueReport = asyncHandler(async (req, res) => {
  const report = await reportService.getRevenueReport({
    from: req.query.from,
    to: req.query.to,
    parkingLocationId: req.query.locationId,
  });
  return ok(res, report);
});

/** GET /api/admin/audit-logs */
const auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultSortBy: 'createdAt', allowedSortBy: ['createdAt'] });
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(),
  ]);
  return ok(res, items, buildMeta(total, page, limit));
});

module.exports = { dashboard, occupancyReport, revenueReport, auditLogs };
