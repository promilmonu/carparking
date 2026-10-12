'use strict';

const router = require('express').Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middlewares/auth');

router.get('/', authenticate, paymentController.listPayments);
router.get('/:id', authenticate, paymentController.getPayment);

module.exports = router;
