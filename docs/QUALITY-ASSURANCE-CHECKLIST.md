# Quality Assurance Checklist — Photo Upgrade

## Implemented in this branch
- [x] Inspected the existing floor-organized CICS facility photo directories.
- [x] Mapped canonical facility codes to the exact existing photo paths.
- [x] Preserved original floor folders, filenames, capitalization, and extensions.
- [x] Kept unmatched photos unassigned rather than mislabeling them.
- [x] Added image mapping to the facility API DTO.
- [x] Added photos to standalone public homepage facility cards.
- [x] Updated React landing hero to use the existing Building/Wider.jpeg photo with fallback.
- [x] Updated standalone landing hero to use the existing Building/Wider.jpeg photo with fallback.
- [x] Added lazy loading and async decoding to facility images.
- [x] Restored data-section-link attributes on Facilities navigation links.

## Required before merge/deployment
- [ ] Confirm all mapped image paths load in a real browser, including HEIC handling.
- [ ] Confirm the hero image loads and falls back correctly.
- [ ] Verify unmatched canonical facilities retain fallback imagery.
- [ ] Run `npm run lint`, `npm test`, and `npm run build`.
- [ ] Check desktop and mobile homepage, facility directory, and detail pages.
- [ ] Confirm the PR is evaluated against the latest main branch, which contains the existing floor-based image folders.

## Optional follow-up
- [ ] If adopting the optimized WebP pack, replace matching images inside their existing floor folders and update the registry; do not flatten the directory structure.

## Data integrity
- [x] No production database records changed.
- [x] No fictional reservations/users/maintenance records inserted.
- [x] No authentication or role permissions changed.
- [x] No production deployment triggered.
