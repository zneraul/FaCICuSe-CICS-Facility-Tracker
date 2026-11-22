import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-facicuse-firestore-rules';
const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');

let testEnv;

const verifiedUser = (uid, email = `${uid}@batstate-u.edu.ph`) =>
  testEnv.authenticatedContext(uid, {
    email,
    email_verified: true,
  }).firestore();

const unverifiedUser = (uid, email = `${uid}@batstate-u.edu.ph`) =>
  testEnv.authenticatedContext(uid, {
    email,
    email_verified: false,
  }).firestore();

const anonymousUser = () => testEnv.unauthenticatedContext().firestore();

const timestamp = () => Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z'));

const profile = (uid, role = 'student') => ({
  uid,
  email: `${uid}@batstate-u.edu.ph`,
  fullName: 'Test User',
  role,
  department: 'CICS',
  academicBlock: 'IT-4101',
  emailVerified: true,
  isActive: true,
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

const facility = (overrides = {}) => ({
  code: 'CICS-01',
  name: 'CICS Learning Room',
  category: 'Learning',
  building: 'CICS Building',
  floor: '2nd Floor',
  capacity: 40,
  description: 'A shared learning room for CICS students.',
  amenities: ['Projector'],
  status: 'Available',
  allowedRoles: ['student', 'professor'],
  openHour: '08:00',
  closeHour: '17:00',
  isReservable: true,
  isArchived: false,
  createdAt: timestamp(),
  updatedAt: timestamp(),
  ...overrides,
});

const reservation = (userId, overrides = {}) => ({
  facilityId: 'facility-1',
  userId,
  reservationDate: '2026-12-01',
  startTime: '09:00',
  endTime: '10:00',
  purpose: 'CICS study group meeting',
  academicBlock: 'IT-4101',
  attendeesCount: 4,
  status: 'Pending',
  createdAt: timestamp(),
  updatedAt: timestamp(),
  ...overrides,
});

const maintenanceIssue = (reporterId) => ({
  facilityId: 'facility-1',
  reporterId,
  category: 'Electrical',
  priority: 'High',
  title: 'Broken ceiling light',
  description: 'The ceiling light is not working in the room.',
  status: 'Open',
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

const notification = (userId) => ({
  userId,
  title: 'Reservation update',
  message: 'Your reservation has been updated.',
  type: 'info',
  isRead: false,
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

const auditLog = (actorUid) => ({
  actorUid,
  actorEmail: `${actorUid}@batstate-u.edu.ph`,
  actorRole: 'student',
  action: 'reservation.created',
  entityType: 'reservation',
  entityId: 'reservation-1',
  details: 'A test reservation was created.',
  createdAt: timestamp(),
});

async function seedDocument(documentPath, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), documentPath), data);
  });
}

async function seedAdmin(uid = 'admin-1') {
  await seedDocument(`admins/${uid}`, {
    uid,
    email: `${uid}@batstate-u.edu.ph`,
    createdAt: timestamp(),
  });
}

before(async () => {
  const rules = await fs.readFile(RULES_PATH, 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

test('users: verified owners can create and update safe profile fields only', async () => {
  const ownerDb = verifiedUser('student-1');
  const peerDb = verifiedUser('student-2');

  await assertSucceeds(setDoc(doc(ownerDb, 'users/student-1'), {
    ...profile('student-1'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  await seedDocument('users/student-2', profile('student-2'));

  await assertSucceeds(getDoc(doc(ownerDb, 'users/student-1')));
  await assertFails(getDoc(doc(ownerDb, 'users/student-2')));

  await assertSucceeds(updateDoc(doc(ownerDb, 'users/student-1'), {
    fullName: 'Updated Student',
    updatedAt: serverTimestamp(),
  }));

  await assertFails(updateDoc(doc(ownerDb, 'users/student-1'), {
    role: 'admin',
    updatedAt: serverTimestamp(),
  }));

  await assertFails(getDocs(query(
    collection(peerDb, 'users'),
    where('uid', '==', 'student-1'),
  )));

  const unverifiedDb = unverifiedUser('unverified-1');
  await assertFails(setDoc(doc(unverifiedDb, 'users/unverified-1'), {
    ...profile('unverified-1'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test('admins: ordinary users cannot grant roles; a trusted admin can create a grant', async () => {
  const studentDb = verifiedUser('student-1');
  await assertFails(setDoc(doc(studentDb, 'admins/student-1'), {
    uid: 'student-1',
    email: 'student-1@batstate-u.edu.ph',
    createdAt: serverTimestamp(),
  }));

  await seedAdmin();
  const adminDb = verifiedUser('admin-1');
  await assertSucceeds(setDoc(doc(adminDb, 'admins/admin-2'), {
    uid: 'admin-2',
    email: 'admin-2@batstate-u.edu.ph',
    createdAt: serverTimestamp(),
  }));
});

test('facilities: public users can read active facilities but cannot mutate them', async () => {
  const publicDb = anonymousUser();
  await seedDocument('facilities/facility-1', facility());
  await seedDocument('facilities/archived-1', facility({
    code: 'CICS-02',
    isArchived: true,
  }));

  await assertSucceeds(getDoc(doc(publicDb, 'facilities/facility-1')));
  await assertFails(getDoc(doc(publicDb, 'facilities/archived-1')));

  const studentDb = verifiedUser('student-1');
  await assertFails(updateDoc(doc(studentDb, 'facilities/facility-1'), {
    status: 'Maintenance',
    updatedAt: serverTimestamp(),
  }));

  await seedAdmin();
  const adminDb = verifiedUser('admin-1');
  await assertSucceeds(updateDoc(doc(adminDb, 'facilities/facility-1'), {
    status: 'Maintenance',
    updatedAt: serverTimestamp(),
  }));
});

test('reservations: reads and cancellation are owner-scoped; students cannot approve bookings', async () => {
  const ownerDb = verifiedUser('student-1');
  const otherDb = verifiedUser('student-2');

  await seedDocument('facilities/facility-1', facility());
  await seedDocument('reservations/reservation-1', reservation('student-1'));
  await seedDocument('reservations/reservation-2', reservation('student-2'));

  await assertSucceeds(getDoc(doc(ownerDb, 'reservations/reservation-1')));
  await assertFails(getDoc(doc(ownerDb, 'reservations/reservation-2')));

  await assertSucceeds(getDocs(query(
    collection(ownerDb, 'reservations'),
    where('userId', '==', 'student-1'),
  )));
  await assertFails(getDocs(query(
    collection(ownerDb, 'reservations'),
    where('userId', '==', 'student-2'),
  )));

  await assertSucceeds(setDoc(doc(ownerDb, 'reservations/own-new-booking'), {
    ...reservation('student-1'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  await assertFails(setDoc(doc(ownerDb, 'reservations/for-someone-else'), {
    ...reservation('student-2'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  await assertSucceeds(updateDoc(doc(ownerDb, 'reservations/reservation-1'), {
    status: 'Cancelled',
    updatedAt: serverTimestamp(),
  }));

  await assertFails(updateDoc(doc(otherDb, 'reservations/reservation-2'), {
    status: 'Confirmed',
    updatedAt: serverTimestamp(),
  }));
});

test('maintenance issues: only the reporter and admins can read reports', async () => {
  const reporterDb = verifiedUser('student-1');
  const otherDb = verifiedUser('student-2');
  await seedDocument('facilities/facility-1', facility());
  await seedDocument('maintenanceIssues/issue-1', maintenanceIssue('student-1'));

  await assertSucceeds(getDoc(doc(reporterDb, 'maintenanceIssues/issue-1')));
  await assertFails(getDoc(doc(otherDb, 'maintenanceIssues/issue-1')));
  await assertSucceeds(getDocs(query(
    collection(reporterDb, 'maintenanceIssues'),
    where('reporterId', '==', 'student-1'),
  )));
  await assertFails(getDocs(query(
    collection(otherDb, 'maintenanceIssues'),
    where('reporterId', '==', 'student-2'),
  )));

  await seedAdmin();
  const adminDb = verifiedUser('admin-1');
  await assertSucceeds(getDoc(doc(adminDb, 'maintenanceIssues/issue-1')));
});

test('notifications: recipients can read and mark as read, but cannot alter content', async () => {
  const recipientDb = verifiedUser('student-1');
  const otherDb = verifiedUser('student-2');
  await seedDocument('notifications/notification-1', notification('student-1'));

  await assertSucceeds(getDoc(doc(recipientDb, 'notifications/notification-1')));
  await assertFails(getDoc(doc(otherDb, 'notifications/notification-1')));

  await assertSucceeds(updateDoc(doc(recipientDb, 'notifications/notification-1'), {
    isRead: true,
    updatedAt: serverTimestamp(),
  }));

  await assertFails(updateDoc(doc(recipientDb, 'notifications/notification-1'), {
    message: 'Tampered notification content',
    updatedAt: serverTimestamp(),
  }));

  await assertFails(deleteDoc(doc(recipientDb, 'notifications/notification-1')));
});

test('audit logs: students cannot read or mutate logs; admins can read; actors can create their own', async () => {
  const studentDb = verifiedUser('student-1');
  await seedDocument('auditLogs/audit-1', auditLog('student-1'));

  await assertFails(getDoc(doc(studentDb, 'auditLogs/audit-1')));
  await assertFails(updateDoc(doc(studentDb, 'auditLogs/audit-1'), {
    details: 'Tampered audit record',
  }));
  await assertFails(deleteDoc(doc(studentDb, 'auditLogs/audit-1')));

  await assertSucceeds(setDoc(doc(studentDb, 'auditLogs/audit-2'), {
    ...auditLog('student-1'),
    createdAt: serverTimestamp(),
  }));

  await seedAdmin();
  const adminDb = verifiedUser('admin-1');
  await assertSucceeds(getDoc(doc(adminDb, 'auditLogs/audit-1')));
});

test('default deny: unknown collections remain inaccessible', async () => {
  const studentDb = verifiedUser('student-1');
  await assertFails(getDoc(doc(studentDb, 'privateInternalData/secret-1')));
  await assertFails(setDoc(doc(studentDb, 'privateInternalData/secret-1'), {
    value: 'must not be stored',
  }));
});
