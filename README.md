# FaCICuSe — Connected Insights, Coordinated Spaces

FaCICuSe is a facility discovery, reservation coordination, scheduling, maintenance reporting, and administrative management system for the **College of Informatics and Computing Sciences (CICS) Building** at **Batangas State University – Alangilan Campus**.

## Project Structure (Hexagonal / Ports & Adapters)

- `client/` — Pure JavaScript React (`JSX`) workspace + standalone HTML5 public landing page.
  - `client/public/` — Standalone HTML5 homepage (`index.html`), custom CSS design system (`assets/css/`), Vanilla JS (`assets/js/`), and organized brand/facility media (`assets/images/`).
  - `client/components/` — Shared layout shells (`PublicLayout`, `AppShell`), `FacilityImage`, and `ErrorBoundary`.
  - `client/context/` — Authentication (`AuthContext`) and synchronized real-time notification state (`NotificationContext`).
  - `client/pages/` — Public directory, sign-in, student/professor workspace, and admin-only management & analytics views.
  - `client/services/` — Backend REST API client and Firebase client adapter.
- `server/domain/` — Pure JavaScript domain entities, canonical 37 CICS Building facility catalog (`projectInfo.js`), value objects (`TimeSlot`, `EmailDomainPolicy`), business rules, and unit tests (`rules.test.js`).
- `server/application/` — Application port contracts (`ports.js`) and use cases (`facilityUseCases`, `reservationUseCases`, `maintenanceUseCases`, `userUseCases`, `dashboardUseCases`, `analyticsUseCases`).
- `server/adapters/inbound/` — Express REST routes, authentication/role middleware, HTTP controllers, and domain error mapping.
- `server/adapters/outbound/` — PostgreSQL Drizzle repositories, local runtime store, Firebase Admin auth adapter, password hasher, and seed service.
- `server/infrastructure/` — Environment configuration and Composition Root (`container.js`).
- `src/db/` — PostgreSQL Drizzle connection and schema definitions.

## Environment Configuration

See `.env.example` for all required environment variables (`PORT`, `APP_URL`, PostgreSQL credentials, `ALLOWED_UNIVERSITY_DOMAINS`, `ADMIN_BOOTSTRAP_EMAILS`, and `SESSION_SECRET`).

## Scripts

- Unit Tests: `npm test`
- Development Server: `npm run dev` (Express + Vite middleware on port `3000`)
- Production Build: `npm run build` followed by `npm start`
