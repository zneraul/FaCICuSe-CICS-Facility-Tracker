# CICS Facility Photo Guide

The approved source photographs are stored in
`client/public/assets/images/facilities/`, organized by floor. Preserve the
folder structure and exact source filenames; do not flatten or duplicate them.

## Asset structure

```text
client/public/assets/images/facilities/
├── 1st Floor/
├── 2nd Floor/
├── 3rd Floor/
├── 4th Floor/
├── 5th Floor/
└── Building/
```

## Corrected facility mappings

The canonical mapping is maintained in `server/domain/facilityMedia.js`.
The four reported records now point to their matching original photographs:

- `CICS-2F-MT` — `2nd Floor/All Gender Restroom.jpeg`
- `CICS-2F-ACC` — `2nd Floor/Accreditation Room.jpeg`
- `CICS-4F-TECH` — `4th Floor/Technicians’ Room.jpeg`
- `CICS-4F-ITL` — `4th Floor/Information Technology Laboratory.HEIC`

All other existing code-to-photo mappings continue to use their matching
floor-folder photographs.

## Building hero

`Building/Wider.jpeg` is the preferred homepage hero.
`Building/Closer.jpeg` is the real-photo fallback.

## Legacy root images

The generic root-level images `cics-building.jpg`, `cics-classroom.jpg`,
`cics-lab.jpg`, and `cics-smart-room.jpg` are no longer needed. Category
fallbacks now use real photographs already included in the floor folders.
The official `facicuse-logo.jpg` remains at the images root.

## Image behavior and compatibility

- Facility photos retain lazy loading and asynchronous decoding.
- The homepage hero uses high fetch priority and a real building-photo fallback.
- Meaningful alt text is retained.
- The IT Laboratory original is HEIC. Its mapping is correct, but browser
  decoding must be verified in the target browsers before marking it fully
  browser-compatible.
