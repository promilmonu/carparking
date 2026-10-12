'use strict';

const mongoose = require('mongoose');
const { VEHICLE_TYPES } = require('./ParkingLocation');

const BOOKING_STATUSES = ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled', 'no-show'];
const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'failed'];

/** Statuses that hold a slot (block overlapping bookings). */
const BLOCKING_STATUSES = ['pending', 'confirmed', 'checked-in'];

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: { type: String, required: true, unique: true, uppercase: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parkingLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true,
    },
    parkingSlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingSlot', required: true, index: true },
    slotNumber: { type: String, required: true },
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    vehicleModel: { type: String, trim: true, default: '', maxlength: 100 },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    bookingStatus: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
    checkedInAt: { type: Date, default: null },
    checkedOutAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index to speed up overlap conflict checks.
bookingSchema.index(
  { parkingSlotId: 1, bookingStatus: 1, startTime: 1, endTime: 1 },
  { name: 'slot_overlap_lookup' }
);
bookingSchema.index({ userId: 1, startTime: -1 });

bookingSchema.pre('validate', function validateTimes() {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after start time');
  }
});

bookingSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.BLOCKING_STATUSES = BLOCKING_STATUSES;
