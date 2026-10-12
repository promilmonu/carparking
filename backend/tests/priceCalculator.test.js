'use strict';

const { calculateTotalPrice } = require('../src/services/priceCalculator');

describe('priceCalculator', () => {
  const base = { hourlyRate: 40, dailyRate: 500 };
  const at = (h) => new Date('2026-01-10T08:00:00Z').getTime() + h * 3600 * 1000;

  test('bills whole hours rounded up', () => {
    const r = calculateTotalPrice({ startTime: at(0), endTime: at(2.5), ...base });
    expect(r.billableHours).toBe(3);
    expect(r.totalAmount).toBe(120);
  });

  test('minimum billing is one hour', () => {
    const r = calculateTotalPrice({ startTime: at(0), endTime: at(0.2), ...base });
    expect(r.billableHours).toBe(1);
    expect(r.totalAmount).toBe(40);
  });

  test('exactly 24 hours uses the daily rate', () => {
    const r = calculateTotalPrice({ startTime: at(0), endTime: at(24), ...base });
    expect(r.fullDays).toBe(1);
    expect(r.totalAmount).toBe(500);
  });

  test('26 hours = daily rate + 2 hourly', () => {
    const r = calculateTotalPrice({ startTime: at(0), endTime: at(26), ...base });
    expect(r.fullDays).toBe(1);
    expect(r.remainingHours).toBe(2);
    expect(r.totalAmount).toBe(580);
  });

  test('rejects end before start', () => {
    expect(() => calculateTotalPrice({ startTime: at(5), endTime: at(1), ...base })).toThrow();
  });

  test('zero daily rate falls back to hourly for all hours', () => {
    const r = calculateTotalPrice({ startTime: at(0), endTime: at(30), hourlyRate: 40, dailyRate: 0 });
    expect(r.totalAmount).toBe(1200);
  });
});
