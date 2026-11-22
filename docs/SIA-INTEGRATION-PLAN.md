# SIA System Integration and Verification Plan — FaCICuSe

This is the implementation-focused integration plan for the existing FaCICuSe codebase. It supplements the SIA final project documentation template; it is not a substitute for the group's full title page, project context, objectives, scope, SDLC schedule, team responsibilities, diagrams, or final presentation material.

## 1. Integration overview

FaCICuSe is composed of a browser frontend, an Express REST API, a domain/application core, outbound persistence and identity adapters, and PostgreSQL in production. The composition root is `server/infrastructure/container.js`.

Integration order:

1. Validate runtime environment configuration.
2. Establish the configured PostgreSQL connection in production.
3. Construct outbound adapters and validate their port contracts.
4. Construct domain/application use cases.
5. Register inbound HTTP controllers, authentication middleware, and role-protected routes.
6. Serve the public landing page, static assets, and authenticated SPA.
7. Run feature-level and end-to-end verification against isolated test services/data.

No schema migration, facility catalog synchronization, or destructive database action should be executed against the shared production database as part of this source organization work.

## 2. Integrated software components

| Component | Source location | Integration responsibility |
|---|---|---|
| Public website | `client/public/` | Public CICS homepage, HTML/CSS/vanilla JS assets |
| Authenticated workspace | `client/` | SPA routes, dashboards, role-specific workflows |
| HTTP/API adapter | `server/adapters/inbound/` | Express routes, request parsing, authentication, authorization, response/error handling |
| Application core | `server/application/` | Facility, reservation, schedule, maintenance, user, dashboard, and analytics use cases |
| Domain core | `server/domain/` | Business rules, domain objects, validations, facility catalog |
| PostgreSQL adapter | `server/adapters/outbound/postgres/` and `server/adapters/outbound/postgres/repositories.js` | Drizzle connection/schema and repository implementations |
| Other outbound adapters | `server/adapters/outbound/` | Local development store, Firebase Auth, password hashing, catalog setup |
| Composition/configuration | `server/infrastructure/` | Runtime validation and dependency wiring |
| Database change set | `drizzle/` and `drizzle.config.ts` | Versioned SQL migrations and Drizzle Kit schema configuration |

## 3. Resource allocation

| Resource | Use | Environment |
|---|---|---|
| Node.js 22+ | Express server and tests | Local/CI/Render |
| Bun or npm | Dependency installation and build tooling | Local/CI/Render |
| PostgreSQL | Persistent users, facilities, reservations, schedules, maintenance, notifications, and audit records | Isolated CI/test DB and configured production DB |
| Firebase Auth Emulator | Authentication integration tests | CI/test only |
| GitHub Actions | Automated test/build gate | CI |
| Render web service | Existing standalone website hosting | Production |
| Browser/devtools | Responsive, navigation, accessibility, and user-flow checks | Local/staging/production read-only |

The Render service and Neon database are existing resources. This plan does not create paid resources or a separate production database.

## 4. Verification plan

Run the automated commands from the repository root:

```bash
npm test
npm run lint
npm run build
```

GitHub Actions also runs Firebase Auth Emulator integration checks and PostgreSQL repository integration tests against its isolated PostgreSQL service.

| Test area | Verification procedure | Expected result |
|---|---|---|
| Runtime health | Request `GET /api/health` | HTTP success and service health payload |
| Public landing | Load `/` and inspect logo, CSS, scripts, and navigation | Homepage and public static assets load without missing files |
| Public facilities | Request `GET /api/public/facilities` and open facility details | Only canonical public facility records are returned |
| Authentication | Test approved university account sign-in, invalid credentials, session refresh, and logout | Session is established/cleared correctly; invalid sign-in is rejected |
| Role authorization | Call admin endpoints as a non-admin and as an administrator | Non-admin access is denied server-side; admin access is permitted |
| Reservations | Create overlapping and non-overlapping reservations in an isolated test DB | Conflicts are rejected; valid records persist |
| Schedules | Verify schedule retrieval and conflict handling | Schedule rules are applied consistently |
| Maintenance | Create and update maintenance reports in test data | Records persist and status changes are returned |
| Analytics | Compare computed results against known isolated test records | Metrics are derived from records; empty data is handled without fabricated values |
| Responsive UI | Check desktop, tablet, and mobile widths | No clipped controls, unreadable text, or unintended horizontal overflow |
| Assets | Check the logo and facility image paths | No missing logo or broken image paths |

Do not test reservation creation, maintenance mutations, login setup, or catalog synchronization using live production records. Use an isolated CI/test database or an explicitly approved staging dataset.

## 5. Change procedures and history

1. Create a focused branch for each change.
2. Inspect the relevant import graph and route dependencies before moving files.
3. Keep each structural move atomic: move the source file, update all imports/configuration, and update tests/documentation in the same change.
4. Run the automated test, lint, and build gates before merging.
5. Review the changed-file list and CI results before merge.
6. Trigger a Render deployment only under a separately authorized release step. The current standalone Render service has automatic deployment disabled.
7. Keep production DB migrations and data changes in a separate reviewed change set.

### This finalization change

- Consolidates the PostgreSQL pool, Drizzle schema, and repository implementation under the outbound PostgreSQL adapter.
- Moves the Drizzle Kit configuration to the repository root and updates its schema path.
- Updates runtime, seed, composition-root, and integration-test imports to the new locations.
- Replaces the old logo asset with an optimized WebP rendition derived from the uploaded image; all UI references now use the canonical `.webp` path.
- Updates architecture, QA, and SIA integration documentation.
- Does not alter REST route paths, domain rules, table definitions, SQL migration contents, environment variable names, the production database, the original repository, or Render infrastructure.

## 6. SIA template completion items outside this technical integration plan

The SIA template also calls for a formal project report containing project context, purpose/description, SMART objectives, scope and limitations, SDLC model/timeline, named team assignments and approval responsibilities, functional/non-functional requirements, Context Diagram, Level-0 DFD, use-case diagram, ERD, GUI documentation, integration resources, training, detailed test responsibility/schedule, and change history.

These items must be completed and verified by the project group using its actual approved proposal, timeline, member assignments, and instructor feedback. They should not be fabricated in the code repository.
