'use strict';

/**
 * Seeds the database with demo data:
 *  - admin@parking.com / Admin@123
 *  - customer@parking.com / Customer@123
 *  - operator@parking.com / Operator@123
 *  - 3 parking locations with slots, sample bookings and payments.
 *
 * Usage: npm run seed
 */

const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const SlotLock = require('../models/SlotLock');
const { calculateTotalPrice } = require('../services/priceCalculator');
const crypto = require('crypto');

async function seedUsers() {
  const defs = [
    { name: 'System Admin', email: 'admin@parking.com', password: 'Admin@123', role: 'admin', phone: '9000000001' },
    { name: 'Demo Customer', email: 'customer@parking.com', password: 'Customer@123', role: 'customer', phone: '9000000002' },
    { name: 'Bay Operator', email: 'operator@parking.com', password: 'Operator@123', role: 'operator', phone: '9000000003' },
    { name: 'Priya Sharma', email: 'priya@example.com', password: 'Customer@123', role: 'customer', phone: '9000000004' },
    { name: 'Rahul Verma', email: 'rahul@example.com', password: 'Customer@123', role: 'customer', phone: '9000000005' },
  ];
  const users = {};
  for (const d of defs) {
    let u = await User.findOne({ email: d.email });
    if (!u) {
      u = new User({ name: d.name, email: d.email, phone: d.phone, role: d.role });
      await u.setPassword(d.password);
      await u.save();
      console.log(`  + user ${d.email} (${d.role})`);
    }
    users[d.role + (d.email.startsWith('demo') ? '' : `:${d.email}`)] = u;
    users[d.email] = u;
  }
  return users;
}

async function seedLocation(def, admin) {
  let location = await ParkingLocation.findOne({ code: def.code });
  if (!location) {
    location = await ParkingLocation.create({ code: def.code, ...def.location, createdBy: admin._id });
    console.log(`  + location ${location.code} (${location.name})`);
  }

  const existingSlots = await ParkingSlot.countDocuments({ parkingLocationId: location._id });
  if (existingSlots === 0) {
    const docs = [];
    for (const block of def.slotBlocks) {
      for (let i = 1; i <= block.count; i += 1) {
        docs.push({
          parkingLocationId: location._id,
          slotNumber: `${block.prefix}${String(i).padStart(2, '0')}`,
          vehicleType: block.vehicleType,
          floor: block.floor,
          category: block.category || 'regular',
          status: 'available',
        });
      }
    }
    await ParkingSlot.insertMany(docs);
    console.log(`    + ${docs.length} slots`);
  }
  return location;
}

async function seedBooking({ user, location, slot, startOffsetH, durationH, status, paid }) {
  const slotDoc = slot || await ParkingSlot.findOne({ parkingLocationId: location._id, status: 'available' });
  if (!slotDoc) return null;

  const startTime = new Date(Date.now() + startOffsetH * 3600 * 1000);
  const endTime = new Date(startTime.getTime() + durationH * 3600 * 1000);
  const overlap = await Booking.findOne({
    parkingSlotId: slotDoc._id,
    bookingStatus: { $in: ['pending', 'confirmed', 'checked-in'] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });
  if (overlap) return null;

  const { totalAmount } = calculateTotalPrice({
    startTime, endTime, hourlyRate: location.hourlyRate, dailyRate: location.dailyRate,
  });

  const booking = await Booking.create({
    bookingReference: `PMS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    userId: user._id,
    parkingLocationId: location._id,
    parkingSlotId: slotDoc._id,
    slotNumber: slotDoc.slotNumber,
    vehicleNumber: 'KA-05-MJ-1234',
    vehicleType: slotDoc.vehicleType,
    vehicleModel: 'Hyundai Creta',
    startTime, endTime, totalAmount,
    paymentStatus: paid ? 'paid' : 'pending',
    bookingStatus: status,
    checkedInAt: status === 'checked-in' || status === 'completed' ? startTime : null,
    checkedOutAt: status === 'completed' ? endTime : null,
    cancelledAt: status === 'cancelled' ? new Date() : null,
  });

  if (paid) {
    await Payment.create({
      bookingId: booking._id,
      userId: user._id,
      amount: totalAmount,
      method: 'upi',
      transactionId: `TXN-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
      status: status === 'cancelled' ? 'refunded' : 'paid',
      paidAt: new Date(),
    });
  }

  const slotStatus = { pending: 'reserved', confirmed: 'reserved', 'checked-in': 'occupied', completed: 'available', cancelled: 'available' }[status] || 'available';
  if (slotStatus !== 'available') {
    await ParkingSlot.updateOne({ _id: slotDoc._id }, { $set: { status: slotStatus } });
  }
  return booking;
}

async function seed() {
  console.log('[seed] starting...');

  await Promise.all([
    User.deleteMany({}), ParkingLocation.deleteMany({}), ParkingSlot.deleteMany({}),
    Booking.deleteMany({}), Payment.deleteMany({}), AuditLog.deleteMany({}), SlotLock.deleteMany({}),
  ]);
  console.log('  cleared existing data');

  const users = await seedUsers();
  const admin = users['admin@parking.com'];
  const customer = users['customer@parking.com'];
  const priya = users['priya@example.com'];
  const rahul = users['rahul@example.com'];

  const locations = [];
  locations.push(await seedLocation({
    code: 'CEN-01',
    location: {
      name: 'Central Plaza Parking', description: 'Premium covered parking in the city center with 24x7 security and EV charging.',
      address: '12 MG Road, Central Plaza', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001',
      coordinates: { lat: 12.9756, lng: 77.6066 },
      parkingType: 'multi-level', supportedVehicleTypes: ['two-wheeler', 'car', 'suv'],
      totalCapacity: 48, hourlyRate: 40, dailyRate: 500, openingTime: '00:00', closingTime: '23:59',
      facilities: ['cctv', 'security', 'ev-charging', 'covered', 'lighting'],
      images: ['https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800'], isActive: true,
    },
    slotBlocks: [
      { prefix: 'A-', count: 20, vehicleType: 'car', floor: '1', category: 'regular' },
      { prefix: 'B-', count: 16, vehicleType: 'suv', floor: '2', category: 'regular' },
      { prefix: 'T-', count: 12, vehicleType: 'two-wheeler', floor: '1', category: 'regular' },
    ],
  }, admin));

  locations.push(await seedLocation({
    code: 'AIR-02',
    location: {
      name: 'Airport Long Stay', description: 'Economy outdoor parking near the airport terminal shuttle stop.',
      address: 'Terminal Road, Airport Zone', city: 'Bengaluru', state: 'Karnataka', postalCode: '560008',
      coordinates: { lat: 13.1986, lng: 77.7066 },
      parkingType: 'outdoor', supportedVehicleTypes: ['car', 'suv', 'commercial'],
      totalCapacity: 30, hourlyRate: 60, dailyRate: 400, openingTime: '00:00', closingTime: '23:59',
      facilities: ['cctv', 'security', 'lighting'], images: [], isActive: true,
    },
    slotBlocks: [
      { prefix: 'P-', count: 20, vehicleType: 'car', floor: 'G', category: 'regular' },
      { prefix: 'V-', count: 10, vehicleType: 'commercial', floor: 'G', category: 'regular' },
    ],
  }, admin));

  locations.push(await seedLocation({
    code: 'MOL-03',
    location: {
      name: 'Metro Mall Basement', description: 'Basement parking linked to the mall and metro station.',
      address: 'Metro Mall, Brigade Cross', city: 'Bengaluru', state: 'Karnataka', postalCode: '560095',
      coordinates: { lat: 12.925, lng: 77.61 },
      parkingType: 'basement', supportedVehicleTypes: ['two-wheeler', 'car', 'suv'],
      totalCapacity: 24, hourlyRate: 30, dailyRate: 350, openingTime: '06:00', closingTime: '23:00',
      facilities: ['cctv', 'covered', 'wheelchair-access', 'restroom'],
      images: [], isActive: false,
    },
    slotBlocks: [
      { prefix: 'BA-', count: 14, vehicleType: 'car', floor: 'B1', category: 'regular' },
      { prefix: 'EA-', count: 4, vehicleType: 'car', floor: 'B1', category: 'ev-charging' },
      { prefix: 'BT-', count: 6, vehicleType: 'two-wheeler', floor: 'B2', category: 'regular' },
    ],
  }, admin));

  // Sample bookings across statuses
  await seedBooking({ user: customer, location: locations[0], startOffsetH: 2, durationH: 3, status: 'confirmed', paid: true });
  await seedBooking({ user: priya, location: locations[0], startOffsetH: -5, durationH: 4, status: 'checked-in', paid: true });
  await seedBooking({ user: rahul, location: locations[0], startOffsetH: 20, durationH: 2, status: 'pending', paid: false });
  await seedBooking({ user: customer, location: locations[0], startOffsetH: -72, durationH: 26, status: 'completed', paid: true });
  await seedBooking({ user: priya, location: locations[1], startOffsetH: 4, durationH: 6, status: 'confirmed', paid: true });
  await seedBooking({ user: rahul, location: locations[1], startOffsetH: -30, durationH: 5, status: 'cancelled', paid: true });

  const counts = {
    users: await User.countDocuments(), locations: await ParkingLocation.countDocuments(),
    slots: await ParkingSlot.countDocuments(), bookings: await Booking.countDocuments(),
    payments: await Payment.countDocuments(),
  };
  console.log('[seed] done:', JSON.stringify(counts));
  console.log('[seed] logins: admin@parking.com/Admin@123, customer@parking.com/Customer@123, operator@parking.com/Operator@123');
}

module.exports = { seed };

// CLI entry: npm run seed
if (require.main === module) {
  (async () => {
    await connectDB();
    await seed();
    await disconnectDB();
  })().catch((err) => { console.error('[seed] failed:', err); process.exit(1); });
}
