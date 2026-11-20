# FaCICuSe Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **PII Isolation**: `/users/{userId}` documents contain personal university email addresses and profiles and MUST only be readable by `request.auth.uid == userId` or a verified System Administrator (`isAdmin()`).
2. **No Self-Assigned Admin Privilege**: A user creating `/users/{userId}` may only register as `student` or `professor` (never `admin`) unless already verified as a bootstrapped admin; non-admins may never mutate `role`, `isActive`, `uid`, `email`, or `createdAt`.
3. **Verified Email Mandate**: Every client write operation requires `request.auth != null && request.auth.token.email_verified == true`.
4. **Facility Referential Integrity**: Every `/reservations/{reservationId}` and `/maintenanceIssues/{issueId}` created by a client MUST reference an existing `/facilities/{facilityId}` document via `exists()`.
5. **Terminal State Locking**: Once a reservation reaches `Cancelled`, `Rejected`, or `Completed`, non-admin users cannot update it. Non-admins may only transition their own `Pending`/`Confirmed` booking to `Cancelled`.
6. **Strict Analytics & Audit Isolation**: `/auditLogs/{auditLogId}` is strictly unreadable by students and professors (admin-only), and immutable once written (`allow update, delete: if false`).
7. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on client writes MUST equal `request.time`.
8. **Query Enforcer**: All `allow list` rules evaluate `resource.data` directly without `get()`/`exists()` calls to prevent scraping and read-cost explosions.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Admin Escalation on Create** (`POST /users/u1`): `{ "uid": "u1", "email": "s@g.batstate-u.edu.ph", "fullName": "Test", "role": "admin", "department": "CICS", "emailVerified": true, "isActive": true }`
2. **Role Escalation Shadow Update** (`PATCH /users/u1`): `{ "fullName": "Test", "role": "admin" }`
3. **PII Cross-User Read** (`GET /users/other-uid` as non-admin `u1`): Attempt to read another user's email/profile.
4. **Unverified Email Spoofing Admin** (`GET /auditLogs/log1` with `email: "markclearmorata4@gmail.com", email_verified: false`): Attempt to bypass admin check without verified email.
5. **Shadow Ghost Field Injection** (`POST /reservations/r1`): Including undocumented key `"isApprovedBypass": true`.
6. **Orphaned Facility Reference** (`POST /reservations/r1`): `{ "facilityId": "NON_EXISTENT_ROOM", "userId": "u1", ... }`.
7. **Identity Spoofing on Reservation** (`POST /reservations/r1` as `u1`): Setting `"userId": "other-student"`.
8. **State Shortcutting on Create** (`POST /reservations/r1` as student `u1`): Setting `"status": "Confirmed"` instead of `"Pending"`.
9. **Terminal State Re-opening** (`PATCH /reservations/r1` as student `u1` when existing status is `"Rejected"`): Trying to set `"status": "Pending"`.
10. **ID Poisoning** (`POST /reservations/<1500-char-invalid-id>`): Oversized/malformed document ID.
11. **Value Poisoning on Update** (`PATCH /users/u1`): Setting `"fullName"` to a 5000-character string or boolean `true`.
12. **Client Timestamp Forgery** (`POST /maintenanceIssues/m1`): Sending client-forged `createdAt` instead of `serverTimestamp()` (`request.time`).
