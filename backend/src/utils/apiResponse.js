'use strict';

/**
 * Consistent response envelope:
 *   success: true,  data, meta (optional pagination)
 *   success: false, message, errors (optional field errors)
 */
function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function created(res, data, meta) {
  return ok(res, data, meta, 201);
}

function fail(res, message, errors, status = 400) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

module.exports = { ok, created, fail };
