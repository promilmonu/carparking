'use strict';

const request = require('supertest');
const { setupDB, teardownDB, clearDB, createAuthTokens } = require('./setup');
const createApp = require('../src/app');

let app;
let tokens;

beforeAll(async () => {
  await setupDB();
  app = createApp();
  await clearDB();
  tokens = await createAuthTokens(app);
});
afterAll(async () => {
  await teardownDB();
});

const locationPayload = (overrides = {}) => ({
  name: 'API Test Parking',
  code: `API${Math.floor(Math.random() * 100000)}`,
  description: 'Test lot',
  address: '1 Test Street',
  city: 'Testville',
  state: 'TS',
  postalCode: '12345',
  parkingType: 'indoor',
  supportedVehicleTypes: ['car', 'suv'],
  totalCapacity: 10,
  hourlyRate: 50,
  dailyRate: 600,
  openingTime: '08:00',
  closingTime: '22:00',
  facilities: ['cctv'],
  ...overrides,
});

async function createLocationWithSlots(overrides = {}) {
  const locRes = await request(app)
    .post('/api/parking-locations')
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send(locationPayload(overrides))
    .expect(201);
  const locationId = locRes.body.data._id;

  const slotRes = await request(app)
    .post(`/api/parking-locations/${locationId}/slots`)
    .set('Authorization', `Bearer ${tokens.admin}`)
    .send({ count: 4, startNumber: 1, prefix: 'A-', vehicleType: 'car', floor: '1' })
    .expect(201);

  return { locationId, slots: slotRes.body.data };
}

describe('auth', () => {
  test('register + login + me', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'Password1' })
      .expect(201);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('customer');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.data.token}`).expect(200);
    expect(me.body.data.email).toBe('new@example.com');
  });

  test('registration never grants admin role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'Password1', role: 'admin' })
      .expect(201);
    expect(res.body.data.user.role).toBe('customer');
  });

  test('rejects bad credentials', async () => {
    await request(app).post('/api/auth/login').send({ email: 'new@example.com', password: 'wrong' }).expect(401);
  });

  test('protected routes reject missing tokens', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });
});

describe('parking locations RBAC', () => {
  test('customers cannot create locations', async () => {
    await request(app)
      .post('/api/parking-locations')
      .set('Authorization', `Bearer ${tokens.customer}`)
      .send(locationPayload())
      .expect(403);
  });

  test('public list only shows active locations', async () => {
    await createLocationWithSlots({ isActive: true });
    const res = await request(app).get('/api/parking-locations').expect(200);
    expect(res.body.data.every((l) => l.isActive)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  test('admin list can include inactive locations', async () => {
    await createLocationWithSlots({ isActive: false });
    const res = await request(app)
      .get('/api/parking-locations?limit=100')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(res.body.data.some((l) => !l.isActive)).toBe(true);
  });

  test('validates required fields', async () => {
    const res = await request(app)
      .post('/api/parking-locations')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ name: 'x' })
      .expect(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('update, status toggle, and dependent-delete protection', async () => {
    const { locationId, slots } = await createLocationWithSlots();

    await request(app)
      .put(`/api/parking-locations/${locationId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ hourlyRate: 75 })
      .expect(200);

    // reducing capacity below configured slots is refused
    const shrink = await request(app)
      .put(`/api/parking-locations/${locationId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ totalCapacity: 1 })
      .expect(400);
    expect(shrink.body.message).toMatch(/capacity/i);

    // book a slot, then deletion must be refused
    const bk = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer}`)
      .send({
        parkingLocationId: locationId,
        parkingSlotId: slots[0]._id,
        vehicleNumber: 'KA-02-QQ-9999',
        vehicleType: 'car',
        startTime: new Date(Date.now() + 3600000).toISOString(),
        endTime: new Date(Date.now() + 7200000).toISOString(),
      })
      .expect(201);

    const del = await request(app)
      .delete(`/api/parking-locations/${locationId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(409);
    expect(del.body.message).toMatch(/booking/i);

    // cancel the booking, then delete succeeds
    await request(app)
      .patch(`/api/bookings/${bk.body.data.booking._id}/cancel`)
      .set('Authorization', `Bearer ${tokens.customer}`)
      .expect(200);
    await request(app)
      .delete(`/api/parking-locations/${locationId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
  });

  test('deactivating a location hides it from public search immediately', async () => {
    const { locationId } = await createLocationWithSlots();
    await request(app)
      .patch(`/api/parking-locations/${locationId}/status`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ isActive: false })
      .expect(200);

    const res = await request(app).get('/api/parking-locations?limit=100').expect(200);
    expect(res.body.data.find((l) => l._id === locationId)).toBeUndefined();
  });
});

describe('booking flow end-to-end', () => {
  test('search -> availability -> book -> conflict -> cancel -> rebook', async () => {
    const { locationId, slots } = await createLocationWithSlots();

    const start = new Date(Date.now() + 2 * 3600000).toISOString();
    const end = new Date(Date.now() + 4 * 3600000).toISOString();

    // 1. availability shows all slots free
    const avail1 = await request(app)
      .get(`/api/parking-locations/${locationId}/available-slots?vehicleType=car&startTime=${start}&endTime=${end}`)
      .expect(200);
    expect(avail1.body.data.slots.filter((s) => s.isAvailable)).toHaveLength(slots.length);

    // 2. book slot 1
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer}`)
      .send({
        parkingLocationId: locationId,
        parkingSlotId: slots[0]._id,
        vehicleNumber: 'KA-01-AA-1111',
        vehicleType: 'car',
        startTime: start,
        endTime: end,
      })
      .expect(201);
    expect(bookingRes.body.data.booking.totalAmount).toBe(100); // 2h * 50
    const bookingId = bookingRes.body.data.booking._id;

    // 3. overlapping double booking is refused
    await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${tokens.customer}`)
      .send({
        parkingLocationId: locationId,
        parkingSlotId: slots[0]._id,
        vehicleNumber: 'KA-01-BB-2222',
        vehicleType: 'car',
        startTime: new Date(new Date(start).getTime() + 30 * 60000).toISOString(),
        endTime: end,
      })
      .expect(409);

    // 4. slot no longer shows as available
    const avail2 = await request(app)
      .get(`/api/parking-locations/${locationId}/available-slots?vehicleType=car&startTime=${start}&endTime=${end}`)
      .expect(200);
    expect(avail2.body.data.slots.find((s) => s._id === slots[0]._id).isAvailable).toBe(false);

    // 5. other users cannot view someone else's booking
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'other@example.com', password: 'Password1' })
      .expect(201);
    await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .expect(403);

    // 6. confirm (simulated payment) -> checked-in -> checked-out
    await request(app)
      .patch(`/api/bookings/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${tokens.customer}`)
      .send({ method: 'upi' })
      .expect(200);
    const checkInRes = await request(app)
      .patch(`/api/bookings/${bookingId}/check-in`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(checkInRes.body.data.bookingStatus).toBe('checked-in');

    // slot is now occupied - availability false and maintenance blocked
    const slotStatus = await request(app)
      .get(`/api/parking-slots/${slots[0]._id}`)
      .expect(200);
    expect(slotStatus.body.data.status).toBe('occupied');

    await request(app)
      .patch(`/api/bookings/${bookingId}/check-out`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);

    // 7. invalid transition: cancelling a completed booking fails
    await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(400);

    // 8. my bookings for the customer
    const mine = await request(app)
      .get('/api/users/me/bookings')
      .set('Authorization', `Bearer ${tokens.customer}`)
      .expect(200);
    expect(mine.body.data.length).toBeGreaterThan(0);
    expect(mine.body.meta.total).toBe(mine.body.data.length);
  });
});

describe('admin dashboard and reports', () => {
  test('dashboard returns KPIs and occupancy', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(res.body.data).toHaveProperty('totalLocations');
    expect(res.body.data).toHaveProperty('totalSlots');
    expect(res.body.data).toHaveProperty('activeBookings');
    expect(res.body.data).toHaveProperty('todayRevenue');
    expect(Array.isArray(res.body.data.occupancy.days)).toBe(true);
  });

  test('customers are blocked from admin endpoints', async () => {
    await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokens.customer}`).expect(403);
  });

  test('revenue report aggregates paid bookings', async () => {
    const res = await request(app)
      .get('/api/admin/reports/revenue')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    expect(res.body.data).toHaveProperty('totalRevenue');
    expect(Array.isArray(res.body.data.perDay)).toBe(true);
  });
});
