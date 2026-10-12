'use strict';

const router = require('express').Router();
const adminController = require('../controllers/adminController');
const userController = require('../controllers/userController');
const validate = require('../middlewares/validate');
const userValidators = require('../validators/userValidators');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate, authorize('admin'));

router.get('/dashboard', adminController.dashboard);
router.get('/reports/occupancy', adminController.occupancyReport);
router.get('/reports/revenue', adminController.revenueReport);
router.get('/audit-logs', adminController.auditLogs);
router.get('/users', validate(userValidators.listUsers), userController.listUsers);
router.patch('/users/:id/status', validate(userValidators.updateUserStatus), userController.updateUserStatus);
router.patch('/users/:id/role', validate(userValidators.updateUserRole), userController.updateUserRole);

module.exports = router;
