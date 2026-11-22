# FaCICuSe — CICS Facility Tracker

[![Live Website](https://img.shields.io/badge/Live%20Website-Open%20FaCICuSe-2ea44f?style=for-the-badge)](https://facicuse-cics-facility-tracker-fg6s.onrender.com)

**Live demo:** https://facicuse-cics-facility-tracker-fg6s.onrender.com

FaCICuSe (Connected Insights, Coordinated Spaces) is a facility discovery, reservation coordination, class scheduling, maintenance reporting, and administrative management system for the College of Informatics and Computing Sciences (CICS) Building at Batangas State University – Alangilan Campus.

This is the standalone repository and deployment. The original `FaCICuSe` repository and its Render service remain separate and unchanged.

## Architecture

The backend follows **Hexagonal Architecture (Ports and Adapters)**. Domain and application rules are kept separate from Express, persistence, and external identity-provider details. The current frontend contains a React/Vite authenticated workspace and a separate semantic HTML public landing page with standalone CSS and vanilla JavaScript assets.

- `client/` — Frontend application.
  - `App.jsx`, `main.jsx` — SPA entry and route composition.
  - `components/` — Shared layouts, navigation, UI components, and error handling.
  - `context/` — Authentication, modal, and notification state.
  - `pages/` — Public pages, role workspaces, reservations, schedules, facility pages, and admin analytics.
  - `services/` — API and Firebase client integration.
  - `utils/` — Client-side helpers.
  - `public/index.html` — Standalone public homepage source.
  - `public/assets/css/`, `public/assets/js/` — Homepage, modal, theme, and interaction assets.
  - `public/assets/images/` — Official logo and approved CICS photographs; facility photos remain organized by floor.
- `server/domain/` — Entities, value objects, domain rules, catalog mappings, and domain tests.
- `server/application/` — Application use cases and port contracts.
- `server/adapters/inbound/` — Express REST routes, controllers, authentication/authorization middleware, rate limiting, and error handling.
- `server/adapters/outbound/` — PostgreSQL and local-store repositories, Firebase Auth adapter, password hashing, and catalog initialization.
  - `postgres/` — PostgreSQL pool/Drizzle connection, schema, and PostgreSQL repository adapter.
- `server/infrastructure/` — Environment validation and the application composition root.
- `drizzle.config.ts` — Drizzle Kit configuration.
- `drizzle/` — Versioned PostgreSQL SQL migrations.
- `docs/` — Architecture, SIA integration/verification guidance, image guide, and QA documentation.
- `firebase-applet-config.json`, `firebase.test.json`, and `firestore.rules*` — Firebase client/emulator/security configuration and its policy test assets; the application's operational records are stored through the PostgreSQL adapter in production.

See [Project Architecture](docs/PROJECT-ARCHITECTURE.md) for the request flow and layer responsibilities, and [SIA Integration Plan](docs/SIA-INTEGRATION-PLAN.md) for integration, testing, and change-control documentation.

## Technology map

- **Frontend:** HTML5, CSS3, JavaScript/JSX, React, and Vite. The public landing page is standalone HTML/CSS/vanilla JavaScript; the authenticated workspace is the existing React SPA.
- **Backend:** Node.js and Express.js REST API.
- **Persistence:** PostgreSQL with Drizzle ORM; the local JSON repository adapter is available for non-production development only.
- **Identity:** Firebase Authentication integration and server-issued HTTP-only sessions.
- **Architecture:** Hexagonal Architecture / Ports and Adapters.

The official IT 314 guideline specifies HTML, CSS, JavaScript/TypeScript and appropriate web technologies alongside a Node.js/Express backend. The stricter project master prompt also described a Vanilla-JavaScript-only frontend. This repository preserves the working React workspace rather than attempting a high-risk frontend rewrite as part of a file-organization task. Confirm with the instructor whether the stricter Vanilla-JavaScript-only interpretation is mandatory before treating that separate migration question as closed.

## Requirements

- Node.js 22+
- Bun (used by the current Render build configuration) or npm for local dependency installation
- PostgreSQL for production

## Local development

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

The GitHub Actions workflow runs domain/auth tests, Firebase Auth emulator integration checks, PostgreSQL adapter integration tests against an isolated CI database, and the production build.

## Deployment

The standalone application is hosted on Render. The existing Render service is configured independently in the Render Dashboard; this repository intentionally does not include legacy Vercel routing or an outdated Render Blueprint.

**Production website:** [Open FaCICuSe](https://facicuse-cics-facility-tracker-fg6s.onrender.com)

Configure these variables in the standalone Render service:

- `NODE_ENV=production`
- `PORT` (Render supplies the service port)
- `APP_URL` (the standalone Render URL)
- `DATABASE_URL` (PostgreSQL connection string)
- `SESSION_SECRET` (random value, at least 32 characters)
- `ALLOWED_UNIVERSITY_DOMAINS`
- `ADMIN_BOOTSTRAP_EMAILS` (only authorized administrator accounts)

The application currently uses the configured Neon PostgreSQL database through `DATABASE_URL`. Repository separation does not create, migrate, or isolate a database. Keep database credentials in Render environment settings, not in Git. Do not run migrations or catalog synchronization against production as part of a source-only cleanup.

## Facility photographs and branding

Use the exact official logo at `client/public/assets/images/facicuse-logo.webp`. Keep the source image's colors and aspect ratio. Use only approved source photographs in `client/public/assets/images/facilities/`; preserve the existing floor folders and exact filenames. See [Facility Photo Guide](docs/FACILITY-IMAGE-GUIDE.md).

## Safety and access control

- Do not commit secrets, private account details, database URLs, or runtime data.
- Keep production persistence and identity credentials in Render environment settings.
- Do not run schema migrations, seed operations, or destructive SQL against production without a separate reviewed plan.
- Administrator-only analytics and management endpoints must remain protected by server-side role authorization, not navigation visibility alone.
- Reservation records indicate bookings, not verified physical occupancy; do not present bookings as sensor-confirmed presence.
