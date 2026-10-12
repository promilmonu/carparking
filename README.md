# Vehicle Parking Management System

A full-stack parking management system with an Angular frontend and Node.js/Express backend. It allows administrators to manage parking locations and slots, and customers to search for and book available parking.

## Tech Stack

- **Frontend**: Angular 22, Angular Material, TypeScript, RxJS, SCSS
- **Backend**: Node.js, Express.js, Mongoose, JWT, bcrypt, Joi, Swagger
- **Database**: MongoDB (or in-memory via mongodb-memory-server for dev/test)

## Project Structure

```
.
├── backend/           # Node.js/Express API
└── frontend/          # Angular application
```

See more in the individual modules as documented below.

## Prerequisites

- Node.js 18+ (tested with Node 24)
- npm 11+
- MongoDB instance (optional - if MONGODB_URI is empty, the backend uses mongodb-memory-server automatically)

## Getting Started

### Backend Setup

1. Navigate to backend:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```
Edit `.env` as needed. Key variables:
- `PORT` (default: 5000)
- `MONGODB_URI` (leave empty to use in-memory MongoDB)
- `JWT_SECRET` (change for production)
- `CORS_ORIGIN` (default: http://localhost:4200)

4. Seed the database (optional but recommended for demo):
```bash
node src/seed.js
```

This creates default users and sample parking data:
- Admin: `admin@example.com` / `admin123`
- Customer: `customer@example.com` / `customer123`

5. Start the development server:
```bash
npm run dev
```
The API will be available at http://localhost:5000. Swagger docs at http://localhost:5000/api-docs.

6. Run backend tests:
```bash
npm test
```

### Frontend Setup

1. Navigate to frontend:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```
The app will be available at http://localhost:4200. API calls are proxied to http://localhost:5000 via `proxy.conf.json`.

4. Build for production:
```bash
npm run build
```
Build output will be in `dist/frontend/`.

## Features

### Admin
- Dashboard with statistics and charts
- Manage parking locations (CRUD, activate/deactivate)
- Manage parking slots (grid view, status updates)
- View and manage bookings
- Customer/operator management
- Reports (occupancy, revenue)
- Settings

### Customer
- Search parking locations
- View location details and availability
- Book parking slots with date/time selection
- View and manage bookings
- Profile management

## API Documentation

When the backend is running, visit http://localhost:5000/api-docs for interactive Swagger documentation.

## Security

- JWT-based authentication
- Role-based access control (admin/customer/operator)
- Passwords hashed with bcrypt
- Request validation with Joi
- Centralized error handling
- CORS configured for frontend origin
- Rate limiting on auth endpoints
- Backend validates availability and calculates prices (never trusts client)

## Notes

- When MONGODB_URI is empty, the server uses mongodb-memory-server - data is ephemeral (lost on restart). Run the seed script each time for demo data.
- The frontend development server proxies API requests to avoid CORS issues.
- Production builds use Angular's optimizer; the build has been tested to complete successfully with memory constraints.
