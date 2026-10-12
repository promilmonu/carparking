'use strict';

const router = require('express').Router();
const bookingController = require('../controllers/bookingController');
const validate = require('../middlewares/validate');
const bookingValidators = require('../validators/bookingValidators');
const { authenticate, authorize } = require('../middlewares/auth');

router.post('/', authenticate, validate(bookingValidators.createBooking), bookingController.createBooking);
router.get('/', authenticate, authorize('admin', 'operator'), validate(bookingValidators.listBookings), bookingController.listBookings);
router.get('/:id', authenticate, bookingController.getBooking);
router.patch('/:id/confirm', authenticate, validate(bookingValidators.payment), bookingController.confirmBooking);
router.patch('/:id/cancel', authenticate, bookingController.cancelBooking);
router.patch('/:id/check-in', authenticate, bookingController.checkIn);
router.patch('/:id/check-out', authenticate, bookingController.checkOut);

module.exports = router;
