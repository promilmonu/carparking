'use strict';

const mongoose = require('mongoose');
const env = require('./env');

let memoryServer = null;

/**
 * Connects to MongoDB. When MONGODB_URI is empty an in-memory MongoDB server
 * is started automatically so the project runs with zero external setup.
 */
async function connectDB(uriOverride) {
  let uri = uriOverride || env.mongoUri;

  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('parking_management');
    // eslint-disable-next-line no-console
    console.log('[db] MONGODB_URI not set - started in-memory MongoDB');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: !env.isProd });
  // eslint-disable-next-line no-console
  console.log(`[db] connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
