'use strict';

const mongoose = require('mongoose');
const { VEHICLE_TYPES } = require('./ParkingLocation');

const SLOT_STATUSES = ['available', 'reserved', 'occupied', 'maintenance'];
const SLOT_CATEGORIES = ['regular', 'accessible', 'ev-charging'];

const parkingSlotSchema = new mongoose.Schema(
  {
    slotNumber: { type: String, required: [true, 'Slot number is required'], trim: true, maxlength: 30 },
    parkingLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true,
    },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    floor: { type: String, trim: true, default: 'G', maxlength: 20 },
    category: { type: String, enum: SLOT_CATEGORIES, default: 'regular' },
    priceCategory: { type: String, trim: true, default: 'standard', maxlength: 30 },
    status: { type: String, enum: SLOT_STATUSES, default: 'available', index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A slot number is unique inside a location.
parkingSlotSchema.index({ parkingLocationId: 1, slotNumber: 1 }, { unique: true });
parkingSlotSchema.index({ parkingLocationId: 1, status: 1, vehicleType: 1 });

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema);
module.exports.SLOT_STATUSES = SLOT_STATUSES;
module.exports.SLOT_CATEGORIES = SLOT_CATEGORIES;
