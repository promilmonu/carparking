'use strict';

/**
 * Backend-authoritative price calculation. Frontend prices are never trusted.
 *
 * Rules:
 *  - Duration is billed in whole hours (rounded up), minimum 1 hour.
 *  - Each completed 24h block is billed at the daily rate; remaining hours
 *    at the hourly rate.
 *  - If the daily rate is zero (or missing) the hourly rate applies to all
 *    hours; likewise if the hourly rate is zero.
 */
function calculateTotalPrice({ startTime, endTime, hourlyRate, dailyRate }) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid start or end time');
  }
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) throw new Error('End time must be after start time');

  const billableHours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  const fullDays = Math.floor(billableHours / 24);
  const remainingHours = billableHours % 24;

  const hourly = Number(hourlyRate) || 0;
  const daily = Number(dailyRate) || 0;

  let total;
  if (fullDays > 0 && daily > 0) {
    // Completed days at the daily rate, remainder at the hourly rate.
    total = fullDays * daily + remainingHours * hourly;
  } else if (hourly > 0) {
    // No usable daily rate: bill every hour at the hourly rate.
    total = billableHours * hourly;
  } else {
    // No hourly rate configured: round any part of a day up to a daily rate.
    total = (fullDays + (remainingHours > 0 ? 1 : 0)) * daily;
  }

  const round2 = (n) => Math.round(n * 100) / 100;
  return {
    billableHours,
    fullDays,
    remainingHours,
    hourlyRate: hourly,
    dailyRate: daily,
    totalAmount: round2(total),
  };
}

module.exports = { calculateTotalPrice };
