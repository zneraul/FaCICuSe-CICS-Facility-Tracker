# FaCICuSe Academic PDF Requirements Review

Review date: 22 November 2026

This review compares the two recently uploaded group project documents with the current standalone FaCICuSe repository and the connected production database. It is a working checklist, not a claim that every requirement has passed final testing.

## Reference documents reviewed

- `Aguilar, Amon, Domingo_IT-BA-3106_Final Project Documentation_WST.docx.pdf` — IT 314: Web Systems and Technologies.
- `Aguilar, Amon, Domingo_IT-BA-3106_Final Project Documentation_SIA.docx.pdf` — IT 312: System Integration and Architecture.
- `SIA-FINAL-PROJECT-TEMPLATE_DOCUMENTATION.pdf` — official SIA document structure and formatting guidance.

## Verified implementation baseline

| Area | Current evidence | Status |
|---|---|---|
| Hosting | Existing Render web service is active on the Free plan; latest deployment is live. | Verified from Render |
| Database | Neon project `facicuse`, production branch is ready, read-only SQL connection succeeds. | Verified from Neon |
| Backend | Node.js/Express REST API; backend code is organized under `backend/`. | Repository evidence |
| Frontend | React/JSX with Vite for authenticated pages; separate public homepage uses HTML/CSS/JavaScript. | Repository evidence |
| Persistence | PostgreSQL with Drizzle; production tables exist for users, facilities, reservations, class schedules, maintenance, notifications, and audit logs. | Verified from Neon |
| Authentication | Firebase Authentication integration with server-side session/authentication handling. | Repository evidence; live user sign-in still needs browser QA |
| Architecture | Domain/application core, ports, adapters, composition root, and automated architecture-boundary tests. | Repository evidence; CI previously passed |
| Analytics | Admin analytics feature exists; reservation bookings must not be described as proof of actual physical occupancy. | Repository evidence and project constraint |

## Production database snapshot

Read-only counts checked on the Neon production branch on 22 November 2026:

| Table | Records |
|---|---:|
| facilities | 38 |
| users | 4 |
| reservations | 3 |
| class_schedules | 5 |
| maintenance_issues | 0 |
| notifications | 10 |
| audit_logs | 20 |

### Inventory discrepancy — resolve before final submission

The group's project proposal and prior project decisions identify an official inventory of **37 CICS facilities**, while the current production `facilities` table contains **38** rows. The additional row currently visible is `Accreditation Room` (facility ID 38, Second Floor, Administrative).

Do not delete, archive, or modify the production row until the group confirms whether Accreditation Room is part of the approved 37-facility inventory or a newly approved addition. After confirmation, align the proposal, facility directory, database catalogue, screenshots, and report wording to one authoritative count.

## IT 314 — WST documentation requirements

The WST PDF asks the group to document the public landing page and the three role-based dashboards, with a screenshot and explanatory paragraph for each. It also asks for a development-process discussion covering front-end development, back-end development, multi-device compatibility, and dashboards/analytics.

### Evidence and work still needed

- [ ] Capture current, genuine screenshots of the public landing page, student dashboard, professor dashboard, and system-administrator dashboard.
- [ ] Write one factual explanatory paragraph per screenshot, describing only controls and behavior that have been verified.
- [ ] Complete the Front-End Development section using the actual stack: HTML/CSS/JavaScript for the public site and React/JSX/Vite for the authenticated workspace. Do not describe the whole frontend as Vanilla JavaScript.
- [ ] Complete the Back-End Development section using Node.js, Express.js, REST API, PostgreSQL, Drizzle ORM, and Firebase Authentication integration.
- [ ] Identify the actual analytics/charting implementation from the source before naming a chart library or visualization tool.
- [ ] Capture desktop, tablet, and mobile evidence and record the tested viewport sizes.
- [ ] Replace all template placeholders such as `(insert)` with verified technologies and implementation details.

## IT 312 — SIA documentation requirements

The SIA template requires the following sections:

### I. Introduction
- [ ] Project Context
- [ ] Purpose and Description
- [ ] SMART Objectives
- [ ] Scope and Limitations

### II. System Analysis
- [ ] Selected Development Model and justification
- [ ] Schedule and Timeline, including an SDLC/Gantt view and explanation
- [ ] Project Teams and Responsibilities, using the group's approved assignments

### III. System Design
- [ ] Functional Requirements
- [ ] Non-Functional Requirements
- [ ] Context Diagram and Level-0 DFD
- [ ] Other applicable diagrams, including Use Case and ERD
- [ ] Graphical User Interface evidence and explanation

### IV. System Integration
- [ ] Integrated-system overview and component relationships
- [ ] Integration Support
- [ ] Resources and their Allocation, including actual test environment and realistic costs
- [ ] Training needs, or a justified statement that no special integration training is required
- [ ] Testing plan by unit/component, test data, procedures, responsible person, and schedule
- [ ] Change Procedures and History based on actual repository/PR/commit history

The existing `docs/SIA-INTEGRATION-PLAN.md` already provides a useful technical starting point for integrated components, integration flow, resources, verification, and change procedure. It is supporting evidence, not a replacement for the formal SIA report.

## Technical facts to keep consistent in both reports

- Production application hosting: Render.
- Production relational database: Neon PostgreSQL.
- Backend: Node.js and Express.js REST API.
- Database access: PostgreSQL repositories through Drizzle ORM.
- Authentication: Firebase Authentication integration and server-side sessions.
- Architecture: Hexagonal Architecture (Ports and Adapters), with business rules separated from HTTP, database, and external-service details.
- Frontend: distinguish the public HTML/CSS/JavaScript homepage from the authenticated React/JSX/Vite workspace.
- Analytics: administrator-only; describe scheduled reservations separately from actual room occupancy.
- Facility inventory: do not state “37” or “38” as final until the discrepancy above is resolved.
- Do not claim live sensor-based occupancy, real-time physical presence detection, or features that have not been implemented and tested.

## Recommended execution order

1. Resolve the official facility inventory count with the group.
2. Complete the WST screenshots and implementation descriptions using the deployed system.
3. Complete the SIA introduction, objectives, scope, development model, timeline, and team assignments from approved group information.
4. Produce and validate the required diagrams against the current code and database schema.
5. Complete system integration resources, test plan, training statement, and change history.
6. Run a final role-based and responsive browser QA pass; use isolated test data for mutations.
7. Assemble the final reports using the SIA template's formatting rules: 8.5 × 13 in paper, 1-inch margins, Times New Roman 12, justified text, and 1.5 line spacing.

## Evidence and safety notes

- This review used read-only Neon queries; no production records were changed.
- No production migrations, seed operations, or test reservations were run.
- Render reported the latest deployment as live. Browser-based end-to-end workflows still require explicit QA.
- Team member task assignments, schedule dates, approval contacts, and actual project costs must come from the group; they must not be invented.
