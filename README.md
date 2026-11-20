# FaCICuSe — CICS Facility Tracker

FaCICuSe (Connected Insights, Coordinated Spaces) is a standalone facility discovery, reservation coordination, class scheduling, maintenance reporting, and administrative management system for the College of Informatics and Computing Sciences (CICS) Building at Batangas State University – Alangilan Campus.

This repository is maintained independently from the original `FaCICuSe` repository. Its source code and deployment are managed here; the original repository and Render service are retained separately.

## Architecture

The application follows Hexagonal Architecture (Ports and Adapters). Domain and application rules remain independent of Express, React, and PostgreSQL implementation details.

- `client/` — React application and standalone public HTML landing page.
  - `components/` — Shared layouts, UI components, and error handling.
  - `context/` — Authentication, modal, and notification state.
  - `pages/` — Public pages, user workspace, and administrator pages.
  - `services/` — API and Firebase client adapters.
  - `public/assets/` — Stylesheets, scripts, logo, and approved CICS facility photographs organized by floor.
- `server/domain/` — Domain entities, value objects, business rules, facility catalog/media mappings, and unit tests.
- `server/application/` — Use cases and inbound/outbound port contracts.
- `server/adapters/inbound/` — Express routes, controllers, middleware, and HTTP error handling.
- `server/adapters/outbound/` — PostgreSQL repositories, local development store, Firebase Auth adapter, password hashing, and catalog initialization.
- `server/infrastructure/` — Runtime configuration and application composition root.
- `src/db/` — PostgreSQL connection and Drizzle schema used by the persistence adapter.
- `drizzle/` — Versioned SQL schema migrations.
- `docs/` — Facility image guide, QA checklist, and project reports.

## Requirements

- Node.js 22+
- Bun (used by the Render build configuration) or npm for local dependency installation
- PostgreSQL database for production

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

The GitHub Actions workflow runs the automated tests, Firebase Auth emulator integration checks, PostgreSQL adapter integration tests, and production build for pull requests targeting `main` and pushes to `main`.

## Deployment

The standalone application is hosted on Render. The Render service is configured independently in the Render dashboard; this repository intentionally does not include legacy Vercel routing or an outdated Render Blueprint.

Configure these variables in the standalone Render service:

- `NODE_ENV=production`
- `PORT` (Render supplies the service port)
- `APP_URL` (the standalone Render URL)
- `DATABASE_URL` (PostgreSQL connection string)
- `SESSION_SECRET` (random value, at least 32 characters)
- `ALLOWED_UNIVERSITY_DOMAINS`
- `ADMIN_BOOTSTRAP_EMAILS` (only authorized administrator accounts)

The application currently uses the configured Neon PostgreSQL database through `DATABASE_URL`. Repository separation does not create or migrate a database. Keep database credentials in Render environment settings, not in Git.

## Facility photographs

Use only approved source photographs in `client/public/assets/images/facilities/`. Preserve the existing floor folders and exact filenames. See [Facility Photo Guide](docs/FACILITY-IMAGE-GUIDE.md).

## Safety

- Do not commit secrets, live account emails, database URLs, or runtime data.
- Do not run schema migrations or seed operations against production without a reviewed migration plan.
- Keep analytics and other administrator-only functions protected by server-side authorization, not navigation visibility alone.
