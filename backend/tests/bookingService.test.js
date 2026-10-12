'use strict';

const { setupDB, teardownDB, clearDB } = require('./setup');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const ParkingLocation = require('../src/models/ParkingLocation');
const ParkingSlot = require('../src/models/ParkingSlot');
const bookingService = require('../src/services/bookingService');

let user, location, slot;

const iso = (offsetMin) => new Date(Date.now() + offsetMin * 60 * 1000).toISOString();
const at = (offsetMin) => new Date(Date.now() + offsetMin * 60 * 1000);

beforeAll(async () => {
  await setupDB();
});
afterAll(async () => {
  await teardownDB();
});
beforeEach(async () => {
  await clearDB();
  user = await User.create({ name: 'U', email: `u${Date.now()}@e.com`, passwordHash: 'x', role: 'customer' });
  location = await ParkingLocation.create({
    name: 'Test Lot', code: `T${Date.now()}`, address: 'addr', city: 'City', state: 'St',
    postalCode: '1', parkingType: 'outdoor', supportedVehicleTypes: ['car'],
    totalCapacity: 5, hourlyRate: 40, dailyRate: 500, openingTime: '00:00', closingTime: '23:59',
  });
  slot = await ParkingSlot.create({
    slotNumber: 'A-01', parkingLocationId: location._id, vehicleType: 'car', floor: 'G',
  });
});

const book = (startMin, endMin, overrides = {}) =>
  bookingService.createBooking({
    userId: user._id,
    body: {
      parkingLocationId: location._id.toString(),
      parkingSlotId: slot._id.toString(),
      vehicleNumber: 'KA-01-AB-1234',
      vehicleType: 'car',
      startTime: iso(startMin),
      endTime: iso(endMin),
      ...overrides,
    },
  });

describe('bookingService.createBooking', () => {
  test('creates a booking priced on the backend', async () => {
    const { booking, pricing } = await book(60, 240); // 3h
    expect(booking.bookingStatus).toBe('pending');
    expect(booking.totalAmount).toBe(120);
    expect(pricing.billableHours).toBe(3);
    expect(booking.bookingReference).toMatch(/^PMS-/);
  });

  test('rejects an overlapping booking with 409', async () => {
    await book(60, 240);
    await expect(book(120, 300)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('rejects a fully contained double booking', async () => {
    await book(60, 300);
    await expect(book(120, 180)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('allows back-to-back bookings (end == next start)', async () => {
    await book(60, 240);
    const second = await book(240, 300);
    expect(second.booking.totalAmount).toBe(40);
  });

  test('allows rebooking after cancellation frees the slot', async () => {
    const { booking } = await book(60, 240);
    booking.bookingStatus = 'cancelled';
    await booking.save();
    await bookingService.syncSlotStatus(slot._id, 'cancelled');
    const second = await book(60, 240);
    expect(second.booking.bookingStatus).toBe('pending');
  });

  test('marks slot as reserved after booking', async () => {
    await book(60, 240);
    const fresh = await ParkingSlot.findById(slot._id);
    expect(fresh.status).toBe('reserved');
  });

  test('rejects vehicle type not matching the slot', async () => {
    await expect(book(60, 240, { vehicleType: 'suv' })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejects maintenance slots', async () => {
    await ParkingSlot.updateOne({ _id: slot._id }, { $set: { status: 'maintenance', isActive: false } });
    await expect(book(60, 240)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejects past start times', async () => {
    await expect(book(-120, 60)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('CONCURRENCY: parallel requests can never double-book the same slot', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => book(60, 240))
    );
    const successes = attempts.filter((a) => a.status === 'fulfilled');
    const failures = attempts.filter((a) => a.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);
    failures.forEach((f) => expect([409, 500]).toContain(f.reason.statusCode ?? 500));
  });

  test('CONCURRENCY: parallel bookings on different slots all succeed', async () => {
    const slots = await ParkingSlot.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        slotNumber: `B-0${i}`, parkingLocationId: location._id, vehicleType: 'car',
      }))
    );
    const attempts = await Promise.allSettled(
      slots.map((s) =>
        bookingService.createBooking({
          userId: user._id,
          body: {
            parkingLocationId: location._id.toString(),
            parkingSlotId: s._id.toString(),
            vehicleNumber: 'KA-01-AB-1234',
            vehicleType: 'car',
            startTime: iso(60),
            endTime: iso(240),
          },
        })
      )
    );
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(5);
  });
});

describe('bookingService.findAvailableSlots', () => {
  test('excludes slots with overlapping bookings', async () => {
    await book(60, 240);
    const slots = await bookingService.findAvailableSlots({
      parkingLocationId: location._id.toString(),
      vehicleType: 'car',
      startTime: at(60),
      endTime: at(240),
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].isAvailable).toBe(false);
  });

  test('includes slots free in the requested window', async () => {
    await book(60, 240);
    const slots = await bookingService.findAvailableSlots({
      parkingLocationId: location._id.toString(),
      vehicleType: 'car',
      startTime: at(300),
      endTime: at(400),
    });
    expect(slots[0].isAvailable).toBe(true);
  });
});
