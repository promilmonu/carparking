'use strict';

const Joi = require('joi');
const { listQuery } = require('./common');
const { VEHICLE_TYPES } = require('../models/ParkingLocation');
const { SLOT_STATUSES, SLOT_CATEGORIES } = require('../models/ParkingSlot');

const slotFields = {
  slotNumber: Joi.string().trim().min(1).max(30).required(),
  vehicleType: Joi.string().valid(...VEHICLE_TYPES).required(),
  floor: Joi.string().trim().allow('').max(20).default('G'),
  category: Joi.string().valid(...SLOT_CATEGORIES).default('regular'),
  priceCategory: Joi.string().trim().allow('').max(30).default('standard'),
  status: Joi.string().valid(...SLOT_STATUSES).default('available'),
  isActive: Joi.boolean().default(true),
};

const singleSlot = Joi.object(slotFields);
const bulkSlot = Joi.object({
  count: Joi.number().integer().min(1).max(500).required(),
  startNumber: Joi.number().integer().min(0).max(9999).default(1),
  prefix: Joi.string().trim().max(10).default(''),
  vehicleType: slotFields.vehicleType,
  floor: slotFields.floor,
  category: slotFields.category,
  priceCategory: slotFields.priceCategory,
  status: slotFields.status,
});

// POST body is either a single slot, a bulk template ({count,startNumber,...}),
// or an explicit array via { slots: [...] }.
const createSlots = {
  params: Joi.object({ locationId: Joi.string().required() }),
  body: Joi.alternatives().try(
    Joi.object({ slots: Joi.array().items(singleSlot).min(1).max(500).required() }),
    bulkSlot,
    singleSlot
  ),
};

const updateSlot = {
  params: Joi.object({ id: Joi.string().required() }),
  body: Joi.object({
    slotNumber: slotFields.slotNumber,
    vehicleType: slotFields.vehicleType,
    floor: slotFields.floor,
    category: slotFields.category,
    priceCategory: slotFields.priceCategory,
    status: slotFields.status,
    isActive: Joi.boolean(),
  }).min(1),
};

const slotStatus = {
  params: Joi.object({ id: Joi.string().required() }),
  body: Joi.object({
    status: Joi.string().valid(...SLOT_STATUSES).required(),
  }),
};

const listSlots = {
  params: Joi.object({ locationId: Joi.string().required() }),
  query: listQuery.keys({
    status: Joi.string().valid(...SLOT_STATUSES),
    vehicleType: Joi.string().valid(...VEHICLE_TYPES),
    floor: Joi.string().allow('').max(20),
    category: Joi.string().valid(...SLOT_CATEGORIES),
    view: Joi.string().valid('grid', 'list'),
  }),
};

module.exports = { createSlots, updateSlot, slotStatus, listSlots };
