'use strict';

const Joi = require('joi');
const { objectId, listQuery } = require('./common');
const { VEHICLE_TYPES } = require('../models/ParkingLocation');

const createBooking = {
  body: Joi.object({
    parkingLocationId: objectId.required(),
    parkingSlotId: objectId.required(),
    vehicleNumber: Joi.string().trim().uppercase().min(3).max(20).required()
      .messages({ 'string.min': 'Vehicle registration number is required' }),
    vehicleType: Joi.string().valid(...VEHICLE_TYPES).required(),
    vehicleModel: Joi.string().trim().allow('').max(100),
    startTime: Joi.date().iso().required().min('now'),
    endTime: Joi.date().iso().required().greater(Joi.ref('startTime')),
  }).messages({
    'date.min': 'Start time cannot be in the past',
    'date.greater': 'End time must be after start time',
  }),
};

const listBookings = {
  query: listQuery.keys({
    bookingStatus: Joi.string().valid('pending', 'confirmed', 'checked-in', 'completed', 'cancelled', 'no-show'),
    paymentStatus: Joi.string().valid('pending', 'paid', 'refunded', 'failed'),
    locationId: objectId,
    userId: objectId,
    from: Joi.date().iso(),
    to: Joi.date().iso(),
  }),
};

const myBookings = {
  query: listQuery.keys({
    scope: Joi.string().valid('current', 'past', 'all').default('all'),
  }),
};

const availableSlots = {
  query: Joi.object({
    vehicleType: Joi.string().valid(...VEHICLE_TYPES).required(),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required().greater(Joi.ref('startTime')),
  }),
};

const paymentSchema = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    method: Joi.string().valid('card', 'upi', 'cash', 'wallet').default('card'),
  }),
};

module.exports = { createBooking, listBookings, myBookings, availableSlots, payment: paymentSchema };
