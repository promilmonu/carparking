'use strict';

const router = require('express').Router();
const authController = require('../controllers/authController');
const validate = require('../middlewares/validate');
const authValidators = require('../validators/authValidators');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authLimiter, validate(authValidators.register), authController.register);
router.post('/login', authLimiter, validate(authValidators.login), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
