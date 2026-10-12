'use strict';

const SlotLock = require('../models/SlotLock');

const LOCK_TTL_MS = 10 * 1000;
const RETRY_DELAY_MS = 25;
const MAX_RETRIES = 80; // ~2s of waiting

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Acquires a short-lived exclusive lock for a parking slot.
 * Uses an atomic upsert with a unique index, so it is safe under concurrency
 * on any MongoDB deployment (standalone included).
 */
async function acquireSlotLock(parkingSlotId) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const now = new Date();
    const lock = await SlotLock.findOneAndUpdate(
      // Only match when the lock is free or its TTL expired. A concurrent
      // insert races into a E11000 duplicate-key error which we retry.
      { parkingSlotId, expiresAt: { $lte: now } },
      { $set: { parkingSlotId, lockedAt: now, expiresAt: new Date(now.getTime() + LOCK_TTL_MS) } },
      { upsert: true, new: true }
    ).catch((err) => {
      // E11000 = another request won the race for this lock; retry.
      if (err && err.code === 11000) return null;
      throw err;
    });
    if (lock) return true;
    await sleep(RETRY_DELAY_MS * (1 + (attempt % 4)));
  }
  throw new Error('Could not acquire slot lock, please retry');
}

async function releaseSlotLock(parkingSlotId) {
  await SlotLock.deleteOne({ parkingSlotId }).catch(() => {});
}

/** Runs `fn` while holding the exclusive lock for the given slot. */
async function withSlotLock(parkingSlotId, fn) {
  await acquireSlotLock(parkingSlotId);
  try {
    return await fn();
  } finally {
    await releaseSlotLock(parkingSlotId);
  }
}

module.exports = { acquireSlotLock, releaseSlotLock, withSlotLock };
