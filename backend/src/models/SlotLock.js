'use strict';

const mongoose = require('mongoose');

/**
 * Per-slot advisory lock used to serialize conflict checks + booking inserts
 * for a given slot, so two concurrent requests can never double-book it.
 * Works on any MongoDB topology (no replica set required).
 */
const slotLockSchema = new mongoose.Schema({
  parkingSlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingSlot', required: true },
  lockedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

slotLockSchema.index({ parkingSlotId: 1 }, { unique: true });
slotLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SlotLock', slotLockSchema);
