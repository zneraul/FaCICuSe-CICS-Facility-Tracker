import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserProfileCreateFields,
  buildUserProfileUpdateFields,
} from './userProfileSync.js';

const firebaseUser = {
  uid: 'student-1',
  email: 'student-1@batstate-u.edu.ph',
  emailVerified: true,
  displayName: 'Firebase Name',
};

test('profile create payload matches Firestore required fields and limits', () => {
  const payload = buildUserProfileCreateFields(firebaseUser, {
    email: 'different@example.com',
    fullName: 'A'.repeat(140),
    department: 'D'.repeat(150),
    role: 'student',
    academicBlock: 'IT-4101',
  });

  assert.equal(payload.uid, firebaseUser.uid);
  assert.equal(payload.email, firebaseUser.email);
  assert.equal(payload.fullName.length, 100);
  assert.equal(payload.department.length, 120);
  assert.equal(payload.role, 'student');
  assert.equal(payload.academicBlock, 'IT-4101');
  assert.equal(payload.emailVerified, true);
  assert.equal(payload.isActive, true);
  assert.equal('createdAt' in payload, false);
  assert.equal('updatedAt' in payload, false);
});

test('profile create payload never promotes a non-admin account from an invalid role value', () => {
  const payload = buildUserProfileCreateFields(firebaseUser, {
    role: 'owner',
    academicBlock: 'NOT-A-BLOCK',
  });

  assert.equal(payload.role, 'student');
  assert.equal('academicBlock' in payload, false);
});

test('profile update payload contains only owner-editable fields', () => {
  const payload = buildUserProfileUpdateFields({
    fullName: 'Updated Name',
    department: 'CICS',
    role: 'admin',
    email: 'attacker@example.com',
    isActive: false,
    academicBlock: 'IT-4101',
  }, firebaseUser);

  assert.deepEqual(payload, {
    fullName: 'Updated Name',
    department: 'CICS',
    academicBlock: 'IT-4101',
  });
});

test('profile sync helpers reject missing identity or profile input', () => {
  assert.equal(buildUserProfileCreateFields(null, {}), null);
  assert.equal(buildUserProfileCreateFields(firebaseUser, null), null);
  assert.equal(buildUserProfileUpdateFields(null, firebaseUser), null);
});
