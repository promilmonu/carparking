'use strict';

/**
 * Normalizes ?page, ?limit, ?sortBy, ?sortOrder query params.
 * Returns mongo-ready skip/limit/sort plus meta for the response envelope.
 */
function getPagination(reqQuery, defaults = {}) {
  const defaultLimit = defaults.limit || 10;
  const maxLimit = defaults.maxLimit || 100;

  let page = parseInt(reqQuery.page, 10);
  let limit = parseInt(reqQuery.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(limit, maxLimit);

  const allowedSortBy = defaults.allowedSortBy || ['createdAt'];
  const fallbackSortBy = defaults.defaultSortBy || allowedSortBy[0];
  let sortBy = typeof reqQuery.sortBy === 'string' ? reqQuery.sortBy : fallbackSortBy;
  if (!allowedSortBy.includes(sortBy)) sortBy = fallbackSortBy;

  const sortOrder = String(reqQuery.sortOrder || defaults.defaultSortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sort: { [sortBy]: sortOrder },
  };
}

function buildMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

module.exports = { getPagination, buildMeta };
