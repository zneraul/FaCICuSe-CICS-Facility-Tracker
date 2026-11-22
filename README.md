# FaCICuSe — CICS Facility Tracker

[![Live Website](https://img.shields.io/badge/Live%20Website-Open%20FaCICuSe-2ea44f?style=for-the-badge)](https://facicuse-cics-facility-tracker-fg6s.onrender.com)

**Live demo:** https://facicuse-cics-facility-tracker-fg6s.onrender.com

FaCICuSe (Connected Insights, Coordinated Spaces) is a facility discovery, reservation coordination, class scheduling, maintenance reporting, and administrative management system for the College of Informatics and Computing Sciences (CICS) Building at Batangas State University – Alangilan Campus.

This is the standalone repository and deployment. The original `FaCICuSe` repository and its Render service remain separate and unchanged.

## Project folders

The top-level folders use familiar frontend/backend names. Each folder is arranged by the part of the website it powers.

- `frontend/` — All browser-side code.
  - `main.jsx`, `App.jsx` — React entry point and page routing.
  - `components/` — Reusable interface parts such as navigation, layout, and sign-in.
  - `pages/` — Homepage views, facility directory, reservations, timetable, maintenance, and admin pages.
  - `context/` — Shared authentication, notifications, and modal state.
  - `services/` — Requests to the backend API and Firebase client setup.
  - `styles/` — Stylesheets for the authenticated workspace.
  - `utils/` — Frontend helper functions.
  - `public/index.html` — Standalone public homepage.
  - `public/assets/css/`, `public/assets/js/` — Homepage styles and browser interactions.
  - `public/assets/images/` — Official FaCICuSe logo, CICS building images, facility photos by floor, and other website images.
- `backend/` — Node.js and Express application.
  - `index.js` — Creates the Express server, connects the API, and serves the website.
  - `routes/apiRoutes.js` — API URL definitions and route-to-controller mapping.
  - `controllers/apiControllers.js` — Handles API requests and responses.
  - `middleware/` — Authentication, role authorization, login rate limiting, and error handling.
  - `domain/` — Core business rules, entities, value objects, and facility information.
  - `application/useCases/` — Reservation, facility, timetable, maintenance, user, dashboard, and analytics workflows.
  - `application/ports.js` — Contracts used by the application core.
  - `database/postgres/` — PostgreSQL connection, Drizzle schema, and database repositories.
  - `database/localJsonRepositories.js` — Local JSON repository for non-production development.
  - `database/facilityCatalogService.js` — Existing facility catalogue and initial schedule synchronization.
  - `services/firebaseAuthService.js` — Firebase Admin authentication integration.
  - `utils/passwordHasher.js` — Password hashing and verification helpers.
  - `config/runtimeConfig.js` — Environment-variable validation and runtime settings.
  - `bootstrap/applicationContainer.js` — Connects repositories, services, use cases, controllers, and routes.
- `drizzle/` — Versioned PostgreSQL SQL migrations.
- `scripts/` — Small build/helper scripts.
- `docs/` — Project architecture, folder guide, image guide, SIA integration, and QA notes.

For a quick explanation of where a particular feature is implemented, see [Project Structure and Code Map](docs/PROJECT-STRUCTURE.md).

## Technology

- **Frontend:** HTML5, CSS3, JavaScript/JSX, React, and Vite.
- **Backend:** Node.js and Express.js REST API.
- **Database:** PostgreSQL with Drizzle ORM.
- **Authentication:** Firebase Authentication integration and server-issued HTTP-only sessions.
- **Architecture:** Domain and application core separated from HTTP, database, and external-service implementations using Ports and Adapters.

## Local development

Requirements: Node.js 22+, npm or Bun, and a local PostgreSQL database for full database-backed testing.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and configure local values. Never commit `.env` or production credentials.

## Validation

```bash
npm test
npm run lint
npm run build
```

GitHub Actions also runs Firebase Auth Emulator integration tests, PostgreSQL repository integration tests against an isolated CI database, and the production build.

## Deployment

The standalone application is hosted on the existing Render service:

**Production website:** [Open FaCICuSe](https://facicuse-cics-facility-tracker-fg6s.onrender.com)

Render is configured separately from this repository. Its current build command is `bun install --frozen-lockfile && bun run build`; its start command is `bun run start`.

Required production settings include `NODE_ENV`, `PORT`, `APP_URL`, `DATABASE_URL`, `SESSION_SECRET`, `ALLOWED_UNIVERSITY_DOMAINS`, and `ADMIN_BOOTSTRAP_EMAILS`. Keep values in Render environment settings, not in Git.

The application uses the configured Neon PostgreSQL database through `DATABASE_URL`. Repository organization does not create, migrate, or isolate a database. Do not run migrations or catalogue synchronization against production as part of a file-organization change.

## Branding and facility photographs

Use the logo at `frontend/public/assets/images/facicuse-logo.webp`. The approved CICS facility photographs are under `frontend/public/assets/images/facilities/`. Preserve the floor folders and exact original filenames. See [Facility Image Guide](docs/FACILITY-IMAGE-GUIDE.md).

## Access control and data safety

- Administrator-only analytics and management endpoints must be protected by backend role authorization, not only by hiding navigation links.
- Reservation records represent scheduled bookings, not confirmed physical room occupancy.
- Do not add sample users, reservations, or maintenance records to production.
- Keep database credentials and other secrets out of source control.
