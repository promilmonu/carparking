'use strict';

const Joi = require('joi');
const { objectId, listQuery } = require('./common');
const { ROLES } = require('../models/User');

const listUsers = {
  query: listQuery.keys({
    role: Joi.string().valid(...ROLES),
    isActive: Joi.boolean(),
  }),
};

const updateUserStatus = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({ isActive: Joi.boolean().required() }),
};

const updateUserRole = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({ role: Joi.string().valid(...ROLES).required() }),
};

module.exports = { listUsers, updateUserStatus, updateUserRole };
