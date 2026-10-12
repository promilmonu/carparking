'use strict';

const mongoose = require('mongoose');

const PARKING_TYPES = ['indoor', 'outdoor', 'basement', 'multi-level'];
const VEHICLE_TYPES = ['two-wheeler', 'car', 'suv', 'commercial'];
const FACILITIES = ['cctv', 'security', 'ev-charging', 'covered', 'lighting', 'wheelchair-access', 'car-wash', 'restroom'];

const parkingLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Location name is required'], trim: true, maxlength: 150 },
    code: {
      type: String,
      required: [true, 'Location code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    address: { type: String, required: [true, 'Address is required'], trim: true, maxlength: 300 },
    city: { type: String, required: [true, 'City is required'], trim: true, maxlength: 100, index: true },
    state: { type: String, required: [true, 'State is required'], trim: true, maxlength: 100 },
    postalCode: { type: String, required: [true, 'Postal code is required'], trim: true, maxlength: 20 },
    coordinates: {
      lat: { type: Number, min: -90, max: 90, default: null },
      lng: { type: Number, min: -180, max: 180, default: null },
    },
    parkingType: { type: String, enum: PARKING_TYPES, required: true },
    supportedVehicleTypes: {
      type: [{ type: String, enum: VEHICLE_TYPES }],
      validate: [(v) => v.length > 0, 'At least one supported vehicle type is required'],
    },
    totalCapacity: {
      type: Number,
      required: [true, 'Total capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Hourly rate is required'],
      min: [0, 'Hourly rate cannot be negative'],
    },
    dailyRate: {
      type: Number,
      required: [true, 'Daily rate is required'],
      min: [0, 'Daily rate cannot be negative'],
    },
    openingTime: {
      type: String,
      required: [true, 'Opening time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Opening time must be HH:mm'],
    },
    closingTime: {
      type: String,
      required: [true, 'Closing time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Closing time must be HH:mm'],
    },
    facilities: { type: [{ type: String, enum: FACILITIES }], default: [] },
    images: { type: [{ type: String, trim: true }], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

parkingLocationSchema.index({ name: 'text', city: 'text', address: 'text', code: 'text' });
parkingLocationSchema.index({ city: 1, isActive: 1 });
parkingLocationSchema.index({ supportedVehicleTypes: 1 });

/** Available slots = total capacity - slots currently reserved/occupied/maintenance. */
parkingLocationSchema.virtual('availableSlots').get(function availableSlots() {
  if (!this.populated('availableSlotCount') && this.availableSlotCount === undefined) return undefined;
  return this.availableSlotCount;
});

module.exports = mongoose.model('ParkingLocation', parkingLocationSchema);
module.exports.PARKING_TYPES = PARKING_TYPES;
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
module.exports.FACILITIES = FACILITIES;
