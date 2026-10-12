'use strict';

const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors;

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate value for a unique field';
    errors = Object.keys(err.keyValue || {}).map((k) => ({
      field: k,
      message: `${k} already exists`,
    }));
  }

  if (statusCode >= 500 && env.nodeEnv !== 'test') {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  if (!env.isProd && err.stack) body.stack = err.stack;

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
