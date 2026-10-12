'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let memoryServer;

/** Boots a shared in-memory MongoDB and connects mongoose to it. */
async function setupDB() {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('parking_test'));
}

async function teardownDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

/** Wipe all collections between tests. */
async function clearDB() {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) await c.deleteMany({});
}

/** Creates an admin + customer token pair against the real app. */
async function createAuthTokens(app) {
  const request = require('supertest');
  const register = (email, role) =>
    request(app)
      .post('/api/auth/register')
      .send({ name: `Test ${role}`, email, password: 'Secret123' })
      .expect(201);

  await register('admin-test@example.com', 'admin');
  await register('customer-test@example.com', 'customer');
  // promote to admin directly in the DB (roles are never granted via API)
  const User = require('../src/models/User');
  await User.updateOne({ email: 'admin-test@example.com' }, { $set: { role: 'admin' } });

  const [adminRes, customerRes] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'admin-test@example.com', password: 'Secret123' }).expect(200),
    request(app).post('/api/auth/login').send({ email: 'customer-test@example.com', password: 'Secret123' }).expect(200),
  ]);

  return {
    admin: adminRes.body.data.token,
    customer: customerRes.body.data.token,
  };
}

module.exports = { setupDB, teardownDB, clearDB, createAuthTokens };
