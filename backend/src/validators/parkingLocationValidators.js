'use strict';

const Joi = require('joi');
const { timeRegex, listQuery } = require('./common');
const { PARKING_TYPES, VEHICLE_TYPES, FACILITIES } = require('../models/ParkingLocation');

const locationBody = Joi.object({
  name: Joi.string().trim().min(3).max(150).required(),
  code: Joi.string().trim().uppercase().alphanum().min(3).max(20).required(),
  description: Joi.string().allow('').max(2000),
  address: Joi.string().trim().min(3).max(300).required(),
  city: Joi.string().trim().min(2).max(100).required(),
  state: Joi.string().trim().min(2).max(100).required(),
  postalCode: Joi.string().trim().min(3).max(20).required(),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).allow(null),
    lng: Joi.number().min(-180).max(180).allow(null),
  }).optional(),
  parkingType: Joi.string().valid(...PARKING_TYPES).required(),
  supportedVehicleTypes: Joi.array()
    .items(Joi.string().valid(...VEHICLE_TYPES))
    .min(1)
    .unique()
    .required(),
  totalCapacity: Joi.number().integer().min(1).max(10000).required(),
  hourlyRate: Joi.number().min(0).max(100000).required(),
  dailyRate: Joi.number().min(0).max(1000000).required(),
  openingTime: Joi.string().pattern(timeRegex).required()
    .messages({ 'string.pattern.base': 'Opening time must be HH:mm' }),
  closingTime: Joi.string().pattern(timeRegex).required()
    .messages({ 'string.pattern.base': 'Closing time must be HH:mm' }),
  facilities: Joi.array().items(Joi.string().valid(...FACILITIES)).default([]),
  images: Joi.array().items(Joi.string().uri({ allowRelative: true }).max(500)).max(10).default([]),
  isActive: Joi.boolean().default(true),
});

const createLocation = { body: locationBody };

const updateLocation = {
  params: Joi.object({ id: Joi.string().required() }),
  body: locationBody.fork(Object.keys(locationBody.describe().keys), (s) => s.optional()),
};

const listLocations = {
  query: listQuery.keys({
    city: Joi.string().allow('').max(100),
    parkingType: Joi.string().valid(...PARKING_TYPES),
    vehicleType: Joi.string().valid(...VEHICLE_TYPES),
    facility: Joi.string().valid(...FACILITIES),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    isActive: Joi.boolean(),
    nearLat: Joi.number().min(-90).max(90),
    nearLng: Joi.number().min(-180).max(180),
  }),
};

const statusSchema = {
  params: Joi.object({ id: Joi.string().required() }),
  body: Joi.object({ isActive: Joi.boolean().required() }),
};

module.exports = { createLocation, updateLocation, listLocations, status: statusSchema };
