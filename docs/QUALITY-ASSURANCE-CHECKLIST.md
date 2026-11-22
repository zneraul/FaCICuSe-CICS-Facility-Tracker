# Project Structure Quality Checklist — FaCICuSe

## Implemented in this change
- [x] Renamed `client/` to `frontend/`.
- [x] Renamed `server/` to `backend/`.
- [x] Grouped API route definitions in `backend/routes/`.
- [x] Grouped API request handlers in `backend/controllers/`.
- [x] Grouped authentication, authorization, rate limiting, and error handling in `backend/middleware/`.
- [x] Grouped PostgreSQL, local repository, and facility catalogue code in `backend/database/`.
- [x] Grouped Firebase authentication under `backend/services/`.
- [x] Grouped password helpers under `backend/utils/`.
- [x] Grouped runtime settings under `backend/config/`.
- [x] Grouped dependency wiring under `backend/bootstrap/`.
- [x] Consolidated the website's static image assets under `frontend/public/assets/`.
- [x] Updated application imports, build scripts, package scripts, CI paths, and Drizzle schema path.
- [x] Added a project folder guide and updated architecture documentation.

## Verification
- [ ] GitHub Actions passes after the folder move.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Public homepage loads with its CSS, JavaScript, logo, and images.
- [ ] Authenticated React pages load and API calls succeed.
- [ ] Reservations, timetable, and maintenance workflows are unchanged.
- [ ] System Administrator-only routes remain protected by server-side authorization.
- [ ] Desktop and mobile layouts remain usable.

## Not changed
- [x] No API endpoint names or HTTP methods were intentionally changed.
- [x] No domain rules, use cases, or database table definitions were intentionally changed.
- [x] No SQL migrations were added or applied.
- [x] No production database records or credentials were changed.
- [x] No new Render, Neon, or paid infrastructure resources were created.
- [x] No production deployment was triggered by this source change.

## Release note

The Render service has automatic deployment disabled. The new folder structure is not live until a separate deployment is started and verified.
