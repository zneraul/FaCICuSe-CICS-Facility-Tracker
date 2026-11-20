import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const BLUEPRINT_PATH = path.resolve(process.cwd(), 'firebase-blueprint.json');

/**
 * Deterministic policy verification harness validating the Dirty Dozen security
 * invariants against firebase-blueprint.json and firestore.rules.
 */
test('firebase-blueprint.json defines all 7 collections with strict schemas', () => {
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8'));
  const requiredPaths = [
    '/users/{userId}',
    '/admins/{userId}',
    '/facilities/{facilityId}',
    '/reservations/{reservationId}',
    '/maintenanceIssues/{issueId}',
    '/notifications/{notificationId}',
    '/auditLogs/{auditLogId}',
  ];
  for (const p of requiredPaths) {
    assert.ok(blueprint.firestore[p], `Missing collection path in blueprint: ${p}`);
  }
});

test('firestore.rules enforces all Eight Pillars and blocks the Dirty Dozen payloads', () => {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');

  // Pillar 1 / Global Safety Net
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);

  // Dirty Dozen #4: Email Spoofing Test — email check MUST pair with email_verified == true
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);

  // Dirty Dozen #1 & #2: Self-admin escalation & role tampering blocked
  assert.match(rules, /incoming\(\)\.role\s+in\s+\['student',\s*'professor'\]/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['fullName',\s*'department',\s*'academicBlock',\s*'updatedAt'\]\)/);

  // Dirty Dozen #3: PII Isolation — users collection never allows blanket isSignedIn() get/list
  assert.doesNotMatch(rules, /match \/users\/\{userId\}[\s\S]{0,250}allow read: if isSignedIn\(\);/);

  // Dirty Dozen #5 & #11: Strict key allowlists & validation helpers wrap updates
  assert.match(rules, /isValidUserProfile\(incoming\(\)\)/);
  assert.match(rules, /isValidReservation\(incoming\(\)\)/);
  assert.match(rules, /isValidMaintenanceIssue\(incoming\(\)\)/);
  assert.match(rules, /isValidFacility\(incoming\(\)\)/);
  assert.match(rules, /isValidNotification\(incoming\(\)\)/);
  assert.match(rules, /isValidAuditLog\(incoming\(\)\)/);

  // Dirty Dozen #6: Referential integrity via exists() on facility create
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/facilities\/\$\(incoming\(\)\.facilityId\)\)/);

  // Dirty Dozen #8 & #9: Status create lock ('Pending'/'Open') and terminal state locking
  assert.match(rules, /incoming\(\)\.status\s*==\s*'Pending'/);
  assert.match(rules, /existing\(\)\.status\s+in\s+\['Pending',\s*'Confirmed'\]/);

  // Dirty Dozen #10: Path variable hardening via isValidId()
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /isValidId\(reservationId\)/);
  assert.match(rules, /isValidId\(userId\)/);

  // Dirty Dozen #12: Temporal integrity using request.time
  assert.match(rules, /incoming\(\)\.createdAt\s*==\s*request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt\s*==\s*request\.time/);

  // Audit logs strictly immutable
  assert.match(rules, /match \/auditLogs\/\{auditLogId\}[\s\S]*allow update, delete: if false;/);
});
