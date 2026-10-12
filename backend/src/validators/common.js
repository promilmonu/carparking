'use strict';

const Joi = require('joi');
const mongoose = require('mongoose');

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.isValidObjectId(value)) return helpers.error('any.invalid');
  return value;
}, 'ObjectId validation').messages({
  'any.invalid': '{{#label}} must be a valid id',
});

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const idParam = Joi.object({ id: objectId.required() });

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('').max(100),
  sortBy: Joi.string().max(50),
  sortOrder: Joi.string().valid('asc', 'desc'),
});

module.exports = { objectId, timeRegex, idParam, listQuery };
