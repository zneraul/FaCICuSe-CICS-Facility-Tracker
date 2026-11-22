# FaCICuSe Architecture and Project Structure

This document describes the structure that is actually present in the repository and the boundaries to preserve during future changes. It aligns the backend organization with the System Integration and Architecture (SIA) Hexagonal Architecture requirement while recording the Web Systems and Technologies (WST) implementation status honestly.

## 1. Architectural overview

The backend follows **Hexagonal Architecture (Ports and Adapters)**. Business rules live in the domain and application core. Express, PostgreSQL, Firebase, and local development storage are adapters around that core.

```text
Browser
  |
  v
Client presentation
  |  Public HTML/CSS/Vanilla JS and authenticated React/Vite workspace
  v
Express REST API (/api)
  |
  v
Inbound adapters
  |  routes, controllers, authentication middleware, error handling
  v
Inbound application ports
  |  use-case APIs declared in server/application/ports.js
  v
Application use cases
  |  orchestration and application workflows
  v
Domain
  |  entities, value objects, invariants, policies, domain errors
  |
  +--> Outbound ports
         |  repository and service contracts in server/application/ports.js
         v
       Outbound adapters
         |  PostgreSQL/Drizzle, Firebase Auth, local JSON development store
         v
       External systems and persistence
```

The application composition root in `server/infrastructure/container.js` constructs the adapters, injects them into use cases, validates the inbound and outbound contracts, and then supplies the controllers to the Express router.

## 2. Directory responsibilities

| Path | Responsibility | Keep here |
|---|---|---|
| `client/public/index.html` | Standalone public landing-page source | Public semantic HTML and public page structure |
| `client/public/assets/css/` | Public-site styles | Shared design tokens, layouts, components, responsive and page-specific CSS |
| `client/public/assets/js/` | Public-site behavior | Browser-side enhancements and vanilla JavaScript interactions |
| `client/public/assets/images/` | Public visual assets | Official FaCICuSe logo and approved CICS facility photographs |
| `client/pages/` | Authenticated/public SPA page modules | Route-level page composition |
| `client/components/` | Reusable interface components | Shared layouts, navigation, modal, image and error components |
| `client/context/` | Client-side application state | Authentication, modal, notification providers |
| `client/services/` | Client integrations | API client and Firebase client setup |
| `client/styles/` | SPA-specific styles | Calendar, analytics and other SPA-only styles |
| `client/utils/` | Browser-side helpers | Route, date, schedule and presentation utilities |
| `server/domain/` | Domain core | Entities, value objects, business rules and domain tests |
| `server/application/useCases/` | Application core | Facility, reservation, scheduling, maintenance, user, dashboard and analytics workflows |
| `server/application/ports.js` | Application boundaries | Inbound use-case contracts and outbound repository/service contracts |
| `server/adapters/inbound/` | Driving adapters | Express routes, controllers, middleware, rate limiting and HTTP error handling |
| `server/adapters/outbound/` | Driven adapters | PostgreSQL repositories, local development repositories, Firebase Auth and password hashing |
| `server/infrastructure/` | Infrastructure and composition | Environment configuration and dependency injection/composition root |
| `src/db/` | PostgreSQL/Drizzle integration | Database connection and schema definitions |
| `drizzle/` | Database change history | Reviewed, versioned SQL migrations |
| `scripts/` | Build and maintenance scripts | Repeatable project automation |
| `docs/` | Project documentation | Architecture, QA, facility photo guidance and implementation reports |
| `.github/workflows/` | Repository automation | CI checks and build validation |

## 3. Port contracts

`server/application/ports.js` contains both sides of the application boundary:

- **Inbound use-case ports** describe the operations the HTTP/controller layer may call. They are grouped by facility, reservation, class schedule, maintenance, user, dashboard and analytics capabilities.
- **Outbound ports** describe the methods required from repositories and external services, such as facility, reservation, issue, user, notification, audit-log and class-schedule persistence.

`assertPortImplemented()` validates contracts. The composition root now checks all declared use-case ports and repository/service ports before exposing the API router. This fails during startup when an adapter or use-case implementation no longer satisfies its declared boundary.

## 4. Dependency rules

1. Domain modules must not import Express, React, Firebase SDKs, database drivers, or infrastructure configuration.
2. Application use cases may depend on domain rules and injected port objects; they must not construct database, Firebase, or HTTP adapters.
3. Inbound adapters translate HTTP requests into application use-case calls and translate results/errors back to HTTP responses.
4. Outbound adapters implement the contracts declared by the application core.
5. Only the composition root should select concrete adapters and wire the application together.
6. SQL schema changes belong in `src/db/schema.ts` and reviewed migration files belong in `drizzle/`. Do not run migrations or seed production data as part of source cleanup.

## 5. Request and data flow

A typical facility or reservation request follows this path:

1. The browser calls an endpoint under `/api`.
2. The inbound Express route applies authentication/authorization middleware and invokes a controller.
3. The controller calls the corresponding application use case.
4. The use case applies business rules and coordinates its injected repository/service ports.
5. The selected outbound adapter reads or writes through PostgreSQL/Drizzle, Firebase Auth, or the local development store as configured.
6. The use-case result returns through the controller as an API response.

The server-side role checks remain authoritative. Hiding a link or route in the browser is not a substitute for backend authorization.

## 6. Entrypoints and intentionally separate web shells

There are two HTML entry points for different jobs; do not treat them as an accidental duplicate:

- Root `index.html` is the Vite/SPA shell used for authenticated application routes.
- `client/public/index.html` is the standalone public homepage. `scripts/copy-public-assets.mjs` copies it to `dist/landing.html`, and the production Express server serves that file for `/`. The same script copies the public assets to `dist/assets/`.

The existing build, server and asset-copy paths depend on this split. Do not delete or relocate either entry point without first updating the build/server configuration and testing direct links to all public and authenticated routes.

## 7. WST technology alignment — current status

The public landing page is authored as HTML and uses custom CSS and browser-side JavaScript. The backend uses Node.js, Express and REST endpoints, with persistent PostgreSQL/Drizzle storage and Firebase authentication.

**Known academic-compliance gap:** the authenticated workspace currently uses React 19, React Router and Vite. The supplied WST project guide explicitly names HTML5, CSS3 and Vanilla JavaScript as the primary frontend technologies and excludes React as a replacement. The current application therefore does **not** satisfy that strict frontend-only criterion end-to-end, even though the public page and backend use the required technologies.

A safe conversion of the full authenticated workspace is a separate route-by-route migration requiring feature parity and regression testing. Do not delete the working SPA or describe the project as fully WST-compliant until that migration has been completed and verified. This finalization pass preserves the live application rather than attempting a destabilizing rewrite.

## 8. Safe file-maintenance rules

- Keep domain rules out of Express controllers and database repositories.
- Do not duplicate business rules in client components.
- Do not move a file solely because its path looks unusual; first verify all imports, build copies and runtime references.
- Preserve approved facility photo filenames and floor folders.
- Keep the official logo at `client/public/assets/images/facicuse-logo.jpg`; existing UI references and favicon paths share this stable asset path.
- Keep local secrets in environment variables and out of Git.
- Preserve the production database and environment configuration. Source cleanup does not authorize production schema changes.
- Prefer small, testable refactors with explicit port contracts over broad rewrites.
