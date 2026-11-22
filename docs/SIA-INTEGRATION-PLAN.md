# SIA System Integration and Verification Plan — FaCICuSe

This document maps the current implementation to its system components and verification responsibilities. It complements the formal SIA project report; it does not replace the group's approved proposal, schedule, team assignments, or required diagrams.

## 1. Integrated components

| Component | Source location | Responsibility |
|---|---|---|
| Public homepage | `frontend/public/` | CICS homepage, public facility information, and public browser scripts |
| Authenticated website | `frontend/` | Pages, dashboards, navigation, contexts, API client, and Firebase client |
| API routes | `backend/routes/apiRoutes.js` | Defines REST endpoints under `/api` |
| Controllers | `backend/controllers/apiControllers.js` | Handles incoming requests and outgoing API responses |
| Middleware | `backend/middleware/` | Session authentication, role authorization, rate limiting, and error handling |
| Domain core | `backend/domain/` | Business entities, validation rules, value objects, and facility/schedule policies |
| Application core | `backend/application/` | Use cases and port contracts |
| Database | `backend/database/` | PostgreSQL and local repository implementations |
| Authentication service | `backend/services/firebaseAuthService.js` | Firebase Admin ID-token verification and session token support |
| Password utilities | `backend/utils/passwordHasher.js` | Password hashing and verification |
| Runtime configuration | `backend/config/runtimeConfig.js` | Reads and validates environment settings |
| Application bootstrap | `backend/bootstrap/applicationContainer.js` | Builds the application by wiring services, repositories, use cases, and controllers |
| Database changes | `drizzle/`, `drizzle.config.ts` | Versioned PostgreSQL migrations and Drizzle configuration |

## 2. Integration flow

1. The root `server.ts` calls `backend/index.js` to start the Express application.
2. Runtime settings are validated through `backend/config/runtimeConfig.js`.
3. `backend/bootstrap/applicationContainer.js` creates database and Firebase adapters, validates their port contracts, and constructs application use cases.
4. The controllers are connected to `backend/routes/apiRoutes.js`.
5. Authentication and role middleware protect the required routes.
6. The frontend communicates with the backend using the `/api` endpoints.
7. PostgreSQL repositories persist production operational data.

## 3. Resource allocation

| Resource | Use | Environment |
|---|---|---|
| Node.js 22+ | Express server and automated tests | Local, CI, Render |
| npm or Bun | Dependency installation and build | Local, CI, Render |
| PostgreSQL | Users, facilities, reservations, schedules, maintenance, notifications, audit logs | Isolated CI database and configured production database |
| Firebase Auth Emulator | Authentication integration testing | CI only |
| GitHub Actions | Automated test/build gate | CI |
| Render | Existing website hosting | Production |
| Browser and developer tools | Responsive, navigation, accessibility, and user-flow checks | Local or production read-only review |

This project uses the existing Render service and configured Neon database. This plan does not create additional paid infrastructure.

## 4. Verification plan

Run the following commands from the repository root:

```bash
npm test
npm run lint
npm run build
```

GitHub Actions also runs Firebase Auth Emulator tests and PostgreSQL repository integration tests against its isolated CI database.

| Area | Verification | Expected result |
|---|---|---|
| Runtime | Request `GET /api/health` | API returns a successful health response |
| Homepage | Load `/` and check the logo, CSS, scripts, and links | Public page and assets load |
| Facilities | Load the public directory and a facility detail | Only canonical public facility data is shown |
| Authentication | Test approved university sign-in, invalid sign-in, session restore, and logout | Valid sessions are established and invalid requests are rejected |
| Authorization | Call admin endpoints as a non-admin and as an administrator | Non-admin access is denied by the backend |
| Reservations | Test overlapping and valid reservations using isolated data | Conflicts are rejected; valid requests persist |
| Timetable | Load schedules and test schedule conflict rules | Schedule data and conflict validation work |
| Maintenance | Create and update a maintenance report in test data | Maintenance records persist and status changes are returned |
| Analytics | Compare output against known isolated test records | Metrics are derived from records without fabricated values |
| Responsive UI | Review desktop, tablet, and mobile widths | Controls remain readable and usable |

Do not test production by creating reservations, maintenance records, accounts, or sample analytics data. Use CI or isolated development data for mutation tests.

## 5. Change procedure

1. Create a focused branch for each structural or feature change.
2. Review all imports, scripts, configuration paths, and documentation references before moving a file.
3. Keep a file move and its import updates in the same commit/PR.
4. Run the automated test, lint, and build checks before merging.
5. Review the PR diff and CI result.
6. Trigger a production deployment only as a separate release action.
7. Handle production database migrations and data changes in a separate reviewed change set.

## 6. This project-structure update

- Renames the main website source folder from `client/` to `frontend/`.
- Renames the Express source folder from `server/` to `backend/`.
- Groups routes, controllers, middleware, database code, services, utilities, configuration, and bootstrap code under clear folder names.
- Moves the Vite static image into `frontend/public/assets/` while retaining its existing browser URL.
- Updates package scripts, CI paths, Drizzle configuration, imports, and documentation.
- Does not change API endpoint paths, domain rules, page behavior, database tables, SQL migrations, environment variable names, or production data.

## 7. Academic report items to complete using approved group information

The formal SIA report may also require project context, objectives, scope and limitations, the selected SDLC, timeline, assigned member responsibilities, functional and non-functional requirements, context diagram, DFD, use-case diagram, ERD, interface documentation, training plan, test schedule, and change history. These details must match the group's actual approved work and must not be invented in the repository.
