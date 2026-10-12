'use strict';

const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/parking-locations', require('./parkingLocationRoutes'));
router.use('/parking-slots', require('./parkingSlotRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/payments', require('./paymentRoutes'));

module.exports = router;
