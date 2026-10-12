'use strict';

const swaggerUi = require('swagger-ui-express');

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    errors: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
  },
};

const okResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {},
    meta: { type: 'object', properties: { total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' }, totalPages: { type: 'integer' } } },
  },
};

const tag = (name, description) => ({ name, description });
const err = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
const ok = (description, schema) => ({ description, content: { 'application/json': { schema: schema || { $ref: '#/components/schemas/Ok' } } } });
const body = (ref) => ({ required: true, content: { 'application/json': { schema: ref } } });
const idParam = (name) => ({ name, in: 'path', required: true, schema: { type: 'string' } });

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Vehicle Parking Management System API',
    version: '1.0.0',
    description:
      'REST API for the Vehicle Parking Management System. Authenticate via /api/auth/login and pass the returned token as "Authorization: Bearer <token>".',
  },
  servers: [{ url: '/api', description: 'Current host' }],
  tags: [
    tag('Auth', 'Registration, login, profile token'),
    tag('Parking Locations', 'CRUD for parking locations'),
    tag('Parking Slots', 'Slot management per location'),
    tag('Bookings', 'Parking bookings with conflict prevention'),
    tag('Admin', 'Dashboard, reports, users, audit logs'),
    tag('Payments', 'Payment records'),
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: errorResponse,
      Ok: okResponse,
      Error400: err('Validation error'),
      ParkingLocation: {
        type: 'object',
        properties: {
          _id: { type: 'string' }, name: { type: 'string' }, code: { type: 'string' },
          description: { type: 'string' }, address: { type: 'string' }, city: { type: 'string' },
          state: { type: 'string' }, postalCode: { type: 'string' },
          coordinates: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
          parkingType: { type: 'string', enum: ['indoor', 'outdoor', 'basement', 'multi-level'] },
          supportedVehicleTypes: { type: 'array', items: { type: 'string', enum: ['two-wheeler', 'car', 'suv', 'commercial'] } },
          totalCapacity: { type: 'integer' }, hourlyRate: { type: 'number' }, dailyRate: { type: 'number' },
          openingTime: { type: 'string', example: '08:00' }, closingTime: { type: 'string', example: '23:00' },
          facilities: { type: 'array', items: { type: 'string' } },
          images: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
        },
      },
      LocationInput: {
        type: 'object',
        required: ['name', 'code', 'address', 'city', 'state', 'postalCode', 'parkingType', 'supportedVehicleTypes', 'totalCapacity', 'hourlyRate', 'dailyRate', 'openingTime', 'closingTime'],
        properties: {
          name: { type: 'string', example: 'Central Plaza Parking' },
          code: { type: 'string', example: 'CEN-01' },
          description: { type: 'string' },
          address: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' }, postalCode: { type: 'string' },
          coordinates: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
          parkingType: { type: 'string', enum: ['indoor', 'outdoor', 'basement', 'multi-level'] },
          supportedVehicleTypes: { type: 'array', items: { type: 'string', enum: ['two-wheeler', 'car', 'suv', 'commercial'] } },
          totalCapacity: { type: 'integer', example: 120 },
          hourlyRate: { type: 'number', example: 40 },
          dailyRate: { type: 'number', example: 600 },
          openingTime: { type: 'string', example: '08:00' },
          closingTime: { type: 'string', example: '23:00' },
          facilities: { type: 'array', items: { type: 'string', enum: ['cctv', 'security', 'ev-charging', 'covered', 'lighting', 'wheelchair-access', 'car-wash', 'restroom'] } },
          images: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
        },
      },
      ParkingSlot: {
        type: 'object',
        properties: {
          _id: { type: 'string' }, slotNumber: { type: 'string', example: 'A-01' },
          parkingLocationId: { type: 'string' }, vehicleType: { type: 'string' },
          floor: { type: 'string' }, category: { type: 'string', enum: ['regular', 'accessible', 'ev-charging'] },
          status: { type: 'string', enum: ['available', 'reserved', 'occupied', 'maintenance'] },
          isActive: { type: 'boolean' },
        },
      },
      SlotInput: {
        type: 'object',
        required: ['slotNumber', 'vehicleType'],
        properties: {
          slotNumber: { type: 'string' }, vehicleType: { type: 'string' },
          floor: { type: 'string' }, category: { type: 'string' }, priceCategory: { type: 'string' },
          status: { type: 'string' }, isActive: { type: 'boolean' },
        },
      },
      SlotBulkInput: {
        type: 'object',
        required: ['count', 'vehicleType'],
        properties: {
          count: { type: 'integer', example: 20 }, startNumber: { type: 'integer', example: 1 },
          prefix: { type: 'string', example: 'A-' }, vehicleType: { type: 'string' },
          floor: { type: 'string' }, category: { type: 'string' }, status: { type: 'string' },
        },
      },
      BookingInput: {
        type: 'object',
        required: ['parkingLocationId', 'parkingSlotId', 'vehicleNumber', 'vehicleType', 'startTime', 'endTime'],
        properties: {
          parkingLocationId: { type: 'string' }, parkingSlotId: { type: 'string' },
          vehicleNumber: { type: 'string', example: 'KA-01-1234' },
          vehicleType: { type: 'string', enum: ['two-wheeler', 'car', 'suv', 'commercial'] },
          vehicleModel: { type: 'string' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], security: [],
        summary: 'Register a customer account',
        requestBody: body({ $ref: '#/components/schemas/LocationInput' }),
        responses: { '201': ok('Token and user'), '400': err('Validation error'), '409': err('Email already registered') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], security: [],
        summary: 'Login and receive a JWT',
        requestBody: body({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } }),
        responses: { '200': ok('Token and user'), '401': err('Invalid credentials') },
      },
    },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Logout (discard token client-side)', responses: { '200': ok('Logged out') } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current user', responses: { '200': ok('Current user'), '401': err('Unauthorized') } } },
    '/parking-locations': {
      get: {
        tags: ['Parking Locations'], security: [],
        summary: 'List/search parking locations (public sees active only)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'parkingType', in: 'query', schema: { type: 'string' } },
          { name: 'vehicleType', in: 'query', schema: { type: 'string' } },
          { name: 'facility', in: 'query', schema: { type: 'string' } },
          { name: 'minPrice', in: 'query', schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', schema: { type: 'number' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': ok('Paginated locations') },
      },
      post: {
        tags: ['Parking Locations'], summary: 'Create a location (admin)',
        requestBody: body({ $ref: '#/components/schemas/LocationInput' }),
        responses: { '201': ok('Created location'), '403': err('Admin only'), '409': err('Duplicate code') },
      },
    },
    '/parking-locations/{id}': {
      get: { tags: ['Parking Locations'], security: [], summary: 'Location detail with slot stats', parameters: [idParam('id')], responses: { '200': ok('Location'), '404': err('Not found') } },
      put: { tags: ['Parking Locations'], summary: 'Update a location (admin)', parameters: [idParam('id')], requestBody: body({ $ref: '#/components/schemas/LocationInput' }), responses: { '200': ok('Updated'), '400': err('Invalid capacity reduction') } },
      delete: { tags: ['Parking Locations'], summary: 'Delete a location (admin, no dependent bookings)', parameters: [idParam('id')], responses: { '200': ok('Deleted'), '409': err('Bookings reference this location') } },
    },
    '/parking-locations/{id}/status': {
      patch: { tags: ['Parking Locations'], summary: 'Activate/deactivate (admin)', parameters: [idParam('id')], requestBody: body({ type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } }), responses: { '200': ok('Updated') } },
    },
    '/parking-locations/{locationId}/available-slots': {
      get: {
        tags: ['Parking Slots'], security: [],
        summary: 'Slots free for a time window',
        parameters: [
          idParam('locationId'),
          { name: 'vehicleType', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'startTime', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
          { name: 'endTime', in: 'query', required: true, schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': ok('Slots with availability flags') },
      },
    },
    '/parking-locations/{locationId}/slots': {
      get: {
        tags: ['Parking Slots'], security: [],
        summary: 'List slots (view=grid returns all for the slot grid)',
        parameters: [idParam('locationId'), { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'vehicleType', in: 'query', schema: { type: 'string' } }, { name: 'view', in: 'query', schema: { type: 'string', enum: ['grid', 'list'] } }],
        responses: { '200': ok('Slots') },
      },
      post: {
        tags: ['Parking Slots'], summary: 'Add single/bulk/array slots (admin)',
        parameters: [idParam('locationId')],
        requestBody: body({ oneOf: [{ $ref: '#/components/schemas/SlotInput' }, { $ref: '#/components/schemas/SlotBulkInput' }, { type: 'object', properties: { slots: { type: 'array', items: { $ref: '#/components/schemas/SlotInput' } } } }] }),
        responses: { '201': ok('Created slots'), '409': err('Duplicate slot numbers') },
      },
    },
    '/parking-slots/{id}': {
      get: { tags: ['Parking Slots'], security: [], summary: 'Slot detail', parameters: [idParam('id')], responses: { '200': ok('Slot') } },
      put: { tags: ['Parking Slots'], summary: 'Update a slot (admin)', parameters: [idParam('id')], requestBody: body({ $ref: '#/components/schemas/SlotInput' }), responses: { '200': ok('Updated') } },
    },
    '/parking-slots/{id}/status': {
      patch: { tags: ['Parking Slots'], summary: 'Update slot status (admin)', parameters: [idParam('id')], requestBody: body({ type: 'object', required: ['status'], properties: { status: { type: 'string' } } }), responses: { '200': ok('Updated') } },
    },
    '/bookings': {
      get: { tags: ['Bookings'], summary: 'All bookings (admin/operator)', responses: { '200': ok('Paginated bookings') } },
      post: { tags: ['Bookings'], summary: 'Create a booking (price computed server-side)', requestBody: body({ $ref: '#/components/schemas/BookingInput' }), responses: { '201': ok('Booking + pricing'), '409': err('Slot already booked for that period') } },
    },
    '/bookings/{id}': { get: { tags: ['Bookings'], summary: 'Booking detail (owner or admin)', parameters: [idParam('id')], responses: { '200': ok('Booking'), '403': err('Not your booking') } } },
    '/bookings/{id}/confirm': { patch: { tags: ['Bookings', 'Payments'], summary: 'Simulated payment; pending -> confirmed', parameters: [idParam('id')], requestBody: body({ type: 'object', properties: { method: { type: 'string', enum: ['card', 'upi', 'cash', 'wallet'] } } }), responses: { '200': ok('Confirmed booking') } } },
    '/bookings/{id}/cancel': { patch: { tags: ['Bookings'], summary: 'Cancel a booking (owner or admin)', parameters: [idParam('id')], responses: { '200': ok('Cancelled booking'), '400': err('Invalid state transition') } } },
    '/bookings/{id}/check-in': { patch: { tags: ['Bookings'], summary: 'Vehicle check-in', parameters: [idParam('id')], responses: { '200': ok('Checked-in booking') } } },
    '/bookings/{id}/check-out': { patch: { tags: ['Bookings'], summary: 'Vehicle check-out (completes booking)', parameters: [idParam('id')], responses: { '200': ok('Completed booking') } } },
    '/users/me': {
      get: { tags: ['Auth'], summary: 'My profile', responses: { '200': ok('Profile') } },
      patch: { tags: ['Auth'], summary: 'Update my profile (name/phone/password)', responses: { '200': ok('Updated profile') } },
    },
    '/users/me/bookings': { get: { tags: ['Bookings'], summary: 'My bookings (scope=current|past|all)', responses: { '200': ok('Paginated bookings') } } },
    '/admin/dashboard': { get: { tags: ['Admin'], summary: 'Dashboard KPIs (admin)', responses: { '200': ok('Stats + occupancy') } } },
    '/admin/reports/occupancy': { get: { tags: ['Admin'], summary: 'Occupancy per day', parameters: [{ name: 'days', in: 'query', schema: { type: 'integer' } }], responses: { '200': ok('Occupancy report') } } },
    '/admin/reports/revenue': { get: { tags: ['Admin'], summary: 'Revenue per day/location', parameters: [{ name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '200': ok('Revenue report') } } },
    '/admin/users': { get: { tags: ['Admin'], summary: 'List users (filter role=customer|operator|admin)', responses: { '200': ok('Paginated users') } } },
    '/admin/users/{id}/status': { patch: { tags: ['Admin'], summary: 'Activate/deactivate a user', parameters: [idParam('id')], responses: { '200': ok('Updated user') } } },
    '/admin/users/{id}/role': { patch: { tags: ['Admin'], summary: 'Change a user role', parameters: [idParam('id')], responses: { '200': ok('Updated user') } } },
    '/admin/audit-logs': { get: { tags: ['Admin'], summary: 'Audit trail of admin actions', responses: { '200': ok('Paginated audit logs') } } },
    '/payments': { get: { tags: ['Payments'], summary: 'Payments (admin: all, customer: own)', responses: { '200': ok('Paginated payments') } } },
    '/payments/{id}': { get: { tags: ['Payments'], summary: 'Payment detail', parameters: [idParam('id')], responses: { '200': ok('Payment') } } },
  },
};

function mount(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { explorer: false, customSiteTitle: 'Parking API Docs' }));
  app.get('/api/docs.json', (req, res) => res.json(spec));
}

module.exports = { spec, mount };
