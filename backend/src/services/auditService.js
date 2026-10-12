'use strict';

const AuditLog = require('../models/AuditLog');

/** Best-effort audit logging - failures never break the main request. */
async function audit(req, action, entityType, entityId, details = {}) {
  try {
    await AuditLog.create({
      actorId: req.user?._id,
      actorEmail: req.user?.email,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      details,
      ip: req.ip || req.headers?.['x-forwarded-for'] || '',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[audit] failed:', err.message);
  }
}

module.exports = { audit };
