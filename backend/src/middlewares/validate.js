'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Joi request validation middleware.
 * Usage: validate(schema) where schema = { body: JoiSchema, query: ..., params: ... }
 * Unknown keys are removed (never stored blindly).
 */
function validate(schemas) {
  return (req, res, next) => {
    const errors = [];
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const { error, value } = schema.validate(req[part], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        for (const d of error.details) {
          errors.push({ field: `${part}.${d.path.join('.')}`, message: d.message });
        }
      } else {
        // Express 5 exposes req.query as a getter-only property, so a plain
        // assignment throws; redefine instead.
        Object.defineProperty(req, part, {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    }
    if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
    next();
  };
}

module.exports = validate;
