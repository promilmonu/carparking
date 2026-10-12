'use strict';

const router = require('express').Router();
const slotController = require('../controllers/parkingSlotController');
const validate = require('../middlewares/validate');
const slotValidators = require('../validators/parkingSlotValidators');
const { authenticate, authorize } = require('../middlewares/auth');

router.get('/:id', slotController.getSlot);
router.put('/:id', authenticate, authorize('admin'), validate(slotValidators.updateSlot), slotController.updateSlot);
router.patch(
  '/:id/status',
  authenticate,
  authorize('admin'),
  validate(slotValidators.slotStatus),
  slotController.setStatus
);

module.exports = router;
