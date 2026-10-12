'use strict';

const Joi = require('joi');

const password = Joi.string()
  .min(6)
  .max(72)
  .messages({ 'string.min': 'Password must be at least 6 characters' });

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: password.required(),
  phone: Joi.string().trim().max(20).allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().max(20).allow(''),
  currentPassword: Joi.string().when('newPassword', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  newPassword: password,
}).min(1);

module.exports = {
  register: { body: registerSchema },
  login: { body: loginSchema },
  updateProfile: { body: updateProfileSchema },
};
