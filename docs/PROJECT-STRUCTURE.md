# Project Structure and Code Map — FaCICuSe

This guide helps identify which file is responsible for each part of the website.

## Start here

| What you need to locate | Start with |
|---|---|
| Frontend entry point | `frontend/main.jsx` |
| Frontend page routing | `frontend/App.jsx` |
| Public homepage HTML | `frontend/public/index.html` |
| Public homepage behavior and account menu | `frontend/public/assets/js/public-site.js` |
| Backend startup | Root `server.ts`, then `backend/index.js` |
| API URLs | `backend/routes/apiRoutes.js` |
| API request/response handling | `backend/controllers/apiControllers.js` |
| Login/session and permissions | `backend/middleware/authMiddleware.js` |
| Core business rules | `backend/domain/` |
| Main feature workflows | `backend/application/useCases/` |
| PostgreSQL connection and tables | `backend/database/postgres/` |
| Local JSON development storage | `backend/database/localJsonRepositories.js` |
| Environment variables | `backend/config/runtimeConfig.js` |
| Connecting all backend parts | `backend/bootstrap/applicationContainer.js` |
| Port contracts and adapter validation | `backend/application/ports.js`, `backend/bootstrap/applicationContainer.js` |
| Architecture boundary tests | `backend/architecture/hexagonalArchitecture.test.js` |
| Database startup and catalog initialization | `backend/index.js`, `backend/database/facilityCatalogService.js` |

## Website feature map

| Website feature | Frontend code | Backend code |
|---|---|---|
| Public homepage | `frontend/public/index.html`, `frontend/public/assets/js/landing.js`, `frontend/public/assets/css/` | `backend/index.js` serves the homepage and static assets |
| Sign in | `frontend/components/SignInModal.jsx`, `frontend/context/AuthContext.jsx`, `frontend/services/firebase.js` | `backend/services/firebaseAuthService.js`, `backend/middleware/authMiddleware.js`, `backend/application/useCases/userUseCases.js` |
| Facility directory | `frontend/pages/FacilitiesDirectoryPage.jsx` | `backend/routes/apiRoutes.js`, `backend/controllers/apiControllers.js`, `backend/application/useCases/facilityUseCases.js` |
| Facility details | `frontend/pages/FacilityDetailPage.jsx` | `backend/application/useCases/facilityUseCases.js`, `backend/database/` |
| Reservations | `frontend/pages/ReservationsPage.jsx` | `backend/application/useCases/reservationUseCases.js` |
| Calendar | `frontend/pages/CalendarPage.jsx` | Reservation and class-schedule use cases |
| Class timetable | `frontend/pages/PublicTimetablePage.jsx` | `backend/application/useCases/classScheduleUseCases.js` |
| Maintenance reports | `frontend/pages/IssuesPage.jsx` | `backend/application/useCases/maintenanceUseCases.js` |
| Admin analytics | `frontend/pages/AdminAnalyticsPage.jsx` | `backend/application/useCases/analyticsUseCases.js` |
| Facility management | `frontend/pages/AdminFacilitiesPage.jsx` | `backend/application/useCases/facilityUseCases.js` |
| User management | `frontend/pages/AdminUsersPage.jsx` | `backend/application/useCases/userUseCases.js` |

## How a request works

For example, when a user submits a reservation:

1. The user interacts with `frontend/pages/ReservationsPage.jsx`.
2. The frontend sends an API request using `frontend/services/api.js`.
3. `backend/routes/apiRoutes.js` matches the request URL.
4. `backend/middleware/authMiddleware.js` checks the session and user role.
5. `backend/controllers/apiControllers.js` receives the request and calls the reservation use case through the injected application service.
6. `backend/application/useCases/reservationUseCases.js` applies the workflow.
7. Domain rules in `backend/domain/` validate the reservation request.
8. The repository in `backend/database/postgres/repositories.js` saves the record to PostgreSQL.
9. The controller returns the result to the frontend.

## Backend folders in plain terms

- **routes** — Which API addresses are available.
- **controllers** — What happens when an API request arrives and what response is sent.
- **middleware** — Checks that happen before a request reaches its controller, such as sign-in and permissions.
- **domain** — Rules the system must follow regardless of the user interface or database.
- **application** — Workflows that coordinate the system's business operations.
- **database** — Code that reads and writes stored information.
- **services** — Connections to external services such as Firebase.
- **utils** — Reusable helper functions.
- **config** — Environment and application settings.
- **bootstrap** — The file that connects the backend parts during startup.

The Ports and Adapters design is enforced at the composition boundary: the application core depends on method contracts in `backend/application/ports.js`, while PostgreSQL, local JSON, and Firebase implementations are created and injected by `backend/bootstrap/applicationContainer.js`. The bootstrap validates required adapter methods before exposing the API router. `backend/index.js` verifies the database and performs the idempotent facility-catalog initialization once during startup; HTTP controllers do not initialize or import database infrastructure. Automated boundary checks live in `backend/architecture/hexagonalArchitecture.test.js`.

## Common commands

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

The root `server.ts` starts the Express backend. The root `index.html` is the Vite entry page for the authenticated React workspace. The standalone public homepage is `frontend/public/index.html`.
