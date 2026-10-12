'use strict';

const router = require('express').Router();
const userController = require('../controllers/userController');
const bookingController = require('../controllers/bookingController');
const validate = require('../middlewares/validate');
const authValidators = require('../validators/authValidators');
const bookingValidators = require('../validators/bookingValidators');
const { authenticate } = require('../middlewares/auth');

router.get('/me', authenticate, userController.getProfile);
router.patch('/me', authenticate, validate(authValidators.updateProfile), userController.updateProfile);
router.get('/me/bookings', authenticate, validate(bookingValidators.myBookings), bookingController.getMyBookings);

module.exports = router;
