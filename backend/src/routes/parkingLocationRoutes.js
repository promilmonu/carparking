'use strict';

const router = require('express').Router();
const locationController = require('../controllers/parkingLocationController');
const slotController = require('../controllers/parkingSlotController');
const validate = require('../middlewares/validate');
const locationValidators = require('../validators/parkingLocationValidators');
const slotValidators = require('../validators/parkingSlotValidators');
const bookingValidators = require('../validators/bookingValidators');
const { authenticate, authorize, optionalAuthenticate } = require('../middlewares/auth');

// Public / customer facing (optional auth so admins can list inactive ones)
router.get('/', optionalAuthenticate, locationController.listLocations);
router.get('/:id', optionalAuthenticate, locationController.getLocation);
router.get('/:locationId/available-slots', validate(bookingValidators.availableSlots), locationController.availableSlots);

// Admin only
router.post('/', authenticate, authorize('admin'), validate(locationValidators.createLocation), locationController.createLocation);
router.put('/:id', authenticate, authorize('admin'), validate(locationValidators.updateLocation), locationController.updateLocation);
router.patch('/:id/status', authenticate, authorize('admin'), validate(locationValidators.status), locationController.setStatus);
router.delete('/:id', authenticate, authorize('admin'), locationController.deleteLocation);

// Nested slot management
router.post(
  '/:locationId/slots',
  authenticate,
  authorize('admin'),
  validate(slotValidators.createSlots),
  slotController.createSlots
);
router.get('/:locationId/slots', validate(slotValidators.listSlots), slotController.listSlots);

module.exports = router;
