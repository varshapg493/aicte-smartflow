# AICTE SmartFlow — SIH26262 prototype

A student prototype for approval workflow visibility, application status tracking, compliance checklist monitoring, and deadline/document alerts. All seeded institutions and records are fictional.

## Requirements
- Node.js 18 or newer
- npm
- Optional: MongoDB Atlas connection string

## Run locally (quick start)
1. Extract this ZIP.
2. Open the extracted `aicte-smartflow` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:5000 in your browser.
6. Test the API at http://localhost:5000/api/health.

The first run uses a local JSON-file database at `data/applications.json`, so the prototype can run without configuring MongoDB. Changes are persisted to that file. Do not delete the file if you want to keep your demo data.

## Use MongoDB Atlas (optional)
1. Copy `.env.example` to a new file named `.env`.
2. Set `MONGODB_URI` to your MongoDB connection string.
3. Restart the server.

If MongoDB connects, the app uses MongoDB. If connection fails, it falls back to the local JSON file database. Keep `.env` private and never commit it.

## Features
- Overview dashboard with live counts and status distribution
- Search and filter applications
- Create an application through a form
- Update application statuses through the backend API
- Compliance checklist that persists changes
- Alerts generated from missing documents and deadlines
- Responsive layout for smaller screens

## API routes
- `GET /api/health`
- `GET /api/summary`
- `GET /api/applications`
- `POST /api/applications`
- `PATCH /api/applications/:id`
- `DELETE /api/applications/:id`
- `GET /api/alerts`

## Important
This is not an official AICTE website, does not connect to AICTE services, and does not process real approvals. Use fictional data in demonstrations. Authentication, role-based permissions, real file uploads, email/SMS notifications, and production security are not implemented.
