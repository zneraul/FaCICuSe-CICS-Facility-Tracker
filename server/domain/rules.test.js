import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanAccessAnalytics,
  assertCanCancelReservation,
  assertCanRescheduleReservation,
  assertReservationValid,
  computeAdminAnalytics,
  computeDashboardMetrics,
  detectScheduleConflicts,
} from './rules.js';
import {
  DEFAULT_UNIVERSITY_DOMAINS,
  EmailDomainPolicy,
  TimeSlot,
  assertRegistrationRoleAllowed,
  normalizeAcademicBlock,
  parseAcademicBlockInfo,
  validatePasswordStrength,
} from './valueObjects.js';
import { createFacilityDraft } from './entities.js';
import {
  AuthorizationError,
  ConflictError,
  DomainError,
  DomainValidationError,
} from './errors.js';
import {
  CICS_FACILITY_CATALOG,
  PROJECT_INFO,
  getPublicProjectInfo,
} from './projectInfo.js';
import {
  generateVerificationToken,
  hashPassword,
  hashVerificationToken,
  verifyPassword,
} from '../adapters/outbound/passwordHasher.js';
import { createReservationUseCases } from '../application/useCases/reservationUseCases.js';
import { createMaintenanceUseCases } from '../application/useCases/maintenanceUseCases.js';
import { createUserUseCases } from '../application/useCases/userUseCases.js';
import { createLocalStoreAdapters } from '../adapters/outbound/localStoreRepositories.js';
import {
  resolvePostLoginPath,
  validateUniversityEmailInput,
} from '../../client/utils/authRedirect.js';
import { validateRuntimeConfig } from '../infrastructure/config.js';
import { DEFAULT_FACILITY_MEDIA, resolveFacilityImageUrl } from './facilityMedia.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const sampleFacility = {
  id: 1,
  code: 'CICS-101',
  name: 'Room 101',
  category: 'Learning',
  building: 'CICS Building',
  floor: 'First Floor',
  capacity: 28,
  isReservable: true,
  isArchived: false,
  status: 'Available',
  allowedRoles: 'student,professor,admin',
  openHour: '08:00',
  closeHour: '20:00',
};

test('TimeSlot detects overlapping and adjacent intervals accurately', () => {
  const slotA = new TimeSlot('2026-11-20', '10:00', '12:00');
  const slotB = new TimeSlot('2026-11-20', '11:00', '13:00');
  const slotC = new TimeSlot('2026-11-20', '12:00', '14:00');

  assert.equal(slotA.overlapsWith(slotB), true);
  assert.equal(slotA.overlapsWith(slotC), false);
});

test('assertReservationValid rejects overlapping active reservations with ConflictError', () => {
  const existing = [
    {
      id: 10,
      reservationDate: '2026-11-20',
      startTime: '09:00',
      endTime: '11:00',
      status: 'Confirmed',
    },
  ];

  assert.throws(
    () =>
      assertReservationValid({
        facility: sampleFacility,
        existingReservations: existing,
        reservationDate: '2026-11-20',
        startTime: '10:30',
        endTime: '12:00',
        attendeesCount: 12,
        purpose: 'Autonomous drone calibration sprint',
        userRole: 'student',
        todayIso: '2026-11-16',
      }),
    ConflictError
  );
});

test('assertReservationValid permits booking over a Cancelled slot and supports ignoreReservationId on reschedule', () => {
  const existing = [
    {
      id: 11,
      reservationDate: '2026-11-20',
      startTime: '09:00',
      endTime: '11:00',
      status: 'Cancelled',
    },
    {
      id: 12,
      reservationDate: '2026-11-20',
      startTime: '13:00',
      endTime: '15:00',
      status: 'Confirmed',
    },
  ];

  const validated = assertReservationValid({
    facility: sampleFacility,
    existingReservations: existing,
    reservationDate: '2026-11-20',
    startTime: '09:00',
    endTime: '11:00',
    attendeesCount: 15,
    purpose: 'Capstone lab work',
    userRole: 'professor',
    todayIso: '2026-11-16',
  });

  assert.equal(validated.attendeesCount, 15);
  assert.equal(validated.slot.durationHours(), 2);

  // Rescheduling reservation #12 in-place to 13:30-15:30 should ignore its own old block
  const rescheduled = assertReservationValid({
    facility: sampleFacility,
    existingReservations: existing,
    reservationDate: '2026-11-20',
    startTime: '13:30',
    endTime: '15:30',
    attendeesCount: 15,
    purpose: 'Capstone lab work',
    userRole: 'professor',
    ignoreReservationId: 12,
  });
  assert.equal(rescheduled.slot.startTime, '13:30');
});

test('assertReservationValid enforces facility capacity and operating hours', () => {
  assert.throws(
    () =>
      assertReservationValid({
        facility: sampleFacility,
        existingReservations: [],
        reservationDate: '2026-11-20',
        startTime: '09:00',
        endTime: '10:00',
        attendeesCount: 50,
        purpose: 'Large assembly',
        userRole: 'professor',
        todayIso: '2026-11-16',
      }),
    DomainValidationError
  );

  assert.throws(
    () =>
      assertReservationValid({
        facility: sampleFacility,
        existingReservations: [],
        reservationDate: '2026-11-20',
        startTime: '06:30',
        endTime: '08:30',
        attendeesCount: 10,
        purpose: 'Early morning session',
        userRole: 'student',
        todayIso: '2026-11-16',
      }),
    DomainValidationError
  );
});

test('assertCanAccessAnalytics strictly blocks students and professors', () => {
  assert.throws(() => assertCanAccessAnalytics('student'), AuthorizationError);
  assert.throws(() => assertCanAccessAnalytics('professor'), AuthorizationError);
  assert.doesNotThrow(() => assertCanAccessAnalytics('admin'));
});

test('assertCanRescheduleReservation restricts rescheduling to admins on active bookings', () => {
  assert.throws(
    () => assertCanRescheduleReservation('student', { id: 1, status: 'Pending' }),
    AuthorizationError
  );
  assert.throws(
    () => assertCanRescheduleReservation('admin', { id: 1, status: 'Cancelled' }),
    ConflictError
  );
  assert.doesNotThrow(() =>
    assertCanRescheduleReservation('admin', { id: 1, status: 'Confirmed' })
  );
});

test('detectScheduleConflicts flags overlapping bookings and maintenance-mode facility conflicts', () => {
  const maintenanceFacility = {
    ...sampleFacility,
    id: 2,
    code: 'CICS-4F-PHYS',
    name: 'Physics Laboratory',
    floor: 'Fourth Floor',
    status: 'Maintenance',
  };
  const conflicts = detectScheduleConflicts(
    [
      {
        id: 101,
        facilityId: 1,
        reservationDate: '2026-11-22',
        startTime: '10:00',
        endTime: '12:00',
        status: 'Confirmed',
      },
      {
        id: 102,
        facilityId: 1,
        reservationDate: '2026-11-22',
        startTime: '11:00',
        endTime: '13:00',
        status: 'Pending',
      },
      {
        id: 103,
        facilityId: 2,
        reservationDate: '2026-11-23',
        startTime: '09:00',
        endTime: '11:00',
        status: 'Confirmed',
      },
    ],
    [sampleFacility, maintenanceFacility]
  );

  assert.equal(conflicts.length, 3);
  assert.ok(conflicts[0].reasons[0].includes('Overlaps booking #102'));
  assert.ok(conflicts[2].reasons[0].includes('Maintenance'));
});

test('assertCanCancelReservation prevents non-owners from cancelling others bookings', () => {
  assert.throws(
    () =>
      assertCanCancelReservation(
        { id: 2, role: 'student' },
        { id: 99, userId: 1, status: 'Pending' }
      ),
    AuthorizationError
  );
  assert.doesNotThrow(() =>
    assertCanCancelReservation(
      { id: 1, role: 'student' },
      { id: 99, userId: 1, status: 'Pending' }
    )
  );
});

test('EmailDomainPolicy enforces configured university domains when provided', () => {
  const strictPolicy = new EmailDomainPolicy('university.edu, faculty.university.edu');
  assert.equal(strictPolicy.assertEmailAllowed('User@University.edu'), 'user@university.edu');
  assert.throws(() => strictPolicy.assertEmailAllowed('person@gmail.com'), DomainValidationError);

  const openPolicy = new EmailDomainPolicy('');
  assert.equal(openPolicy.assertEmailAllowed('person@gmail.com'), 'person@gmail.com');
});

test('computeDashboardMetrics and computeAdminAnalytics calculate exact stored totals, trends, and filters without fabricating numbers', () => {
  const reservations = [
    {
      id: 1,
      facilityId: 1,
      userId: 5,
      reservationDate: '2026-11-20',
      startTime: '10:00',
      endTime: '12:00',
      status: 'Confirmed',
    },
    {
      id: 2,
      facilityId: 1,
      userId: 6,
      reservationDate: '2026-11-21',
      startTime: '14:00',
      endTime: '15:30',
      status: 'Pending',
    },
  ];
  const issues = [
    { id: 1, facilityId: 1, reporterId: 5, category: 'HVAC', priority: 'High', status: 'Open' },
  ];

  const studentMetrics = computeDashboardMetrics({
    reservations,
    issues,
    facilities: [sampleFacility],
    user: { id: 5, role: 'student' },
    todayIso: '2026-11-16',
  });

  assert.equal(studentMetrics.totalReservations, 1);
  assert.equal(studentMetrics.confirmedReservations, 1);
  assert.equal(studentMetrics.pendingReservations, 0);
  assert.equal(studentMetrics.openIssues, 1);

  const adminAnalytics = computeAdminAnalytics({
    reservations,
    issues,
    facilities: [sampleFacility],
    users: [
      { id: 5, role: 'student' },
      { id: 6, role: 'professor' },
      { id: 1, role: 'admin' },
    ],
  });

  assert.equal(adminAnalytics.totals.confirmedScheduledHours, 2);
  assert.equal(adminAnalytics.reservationsByStatus.Pending, 1);
  assert.equal(adminAnalytics.reservationsByStatus.Confirmed, 1);
  assert.equal(adminAnalytics.issuesByCategory.HVAC, 1);
  assert.equal(adminAnalytics.activityOverTime.length, 2);
  assert.equal(adminAnalytics.peakBookingPeriods.find((p) => p.shortLabel === '06–11').requests, 1);
  assert.equal(adminAnalytics.peakBookingPeriods.find((p) => p.shortLabel === '14–18').requests, 1);

  // Filter by status returns accurate subset
  const confirmedOnly = computeAdminAnalytics({
    reservations,
    issues,
    facilities: [sampleFacility],
    users: [{ id: 1, role: 'admin' }],
    filters: { status: 'Confirmed' },
  });
  assert.equal(confirmedOnly.totals.reservations, 1);
  assert.equal(confirmedOnly.reservationsByStatus.Pending, 0);
});

test('PROJECT_INFO and CICS_FACILITY_CATALOG reflect verified BatStateU CICS proposal facts accurately', () => {
  const payload = getPublicProjectInfo();
  assert.equal(payload.project.name, 'FaCICuSe');
  assert.equal(payload.project.meaning, 'Facility in Use');
  assert.equal(payload.project.tagline, 'Connected Insights, Coordinated Spaces');
  assert.match(payload.project.institution, /Batangas State University/);
  assert.match(payload.project.college, /College of Informatics and Computing Sciences/);
  assert.match(payload.project.course, /IT 314/);
  assert.equal(payload.project.contactEmail, 'facicuse@gmail.com');

  assert.equal(PROJECT_INFO.teamMembers.length, 3);
  assert.deepEqual(
    PROJECT_INFO.teamMembers.map((m) => m.directoryName),
    [
      'Aguilar, Hazel C.',
      'Amon, Czharrina Mhariell B.',
      'Domingo, Bernardo Laurenz Ulyssys M.',
    ]
  );

  // Verify exact 38 facilities across 5 floors and 3 categories (26 + 7 + 5)
  assert.equal(CICS_FACILITY_CATALOG.length, 38);
  const floors = new Set(CICS_FACILITY_CATALOG.map((r) => r.floor));
  assert.equal(floors.size, 5);
  assert.equal(CICS_FACILITY_CATALOG.filter((r) => r.category === 'Learning').length, 26);
  assert.equal(CICS_FACILITY_CATALOG.filter((r) => r.category === 'Administrative').length, 7);
  assert.equal(CICS_FACILITY_CATALOG.filter((r) => r.category === 'Support').length, 5);
});

test('normalizeAcademicBlock and parseAcademicBlockInfo validate BSIT year/semester/block codes while keeping them optional', () => {
  assert.equal(normalizeAcademicBlock(null), null);
  assert.equal(normalizeAcademicBlock('   '), null);
  assert.equal(normalizeAcademicBlock('it-3106'), 'IT-3106');

  const validSamples = [
    'IT-1109',
    'IT-1209',
    'IT-2109',
    'IT-2209',
    'IT-3106',
    'IT-3206',
    'IT-4106',
    'IT-4206',
    'IT-3107',
  ];
  for (const sample of validSamples) {
    assert.equal(normalizeAcademicBlock(sample), sample);
  }

  const parsed = parseAcademicBlockInfo('IT-3206');
  assert.deepEqual(parsed, {
    code: 'IT-3206',
    program: 'BSIT',
    yearLevel: 3,
    yearLabel: '3rd Year',
    semester: 2,
    semesterLabel: '2nd Semester',
    blockNumber: '06',
  });

  for (const invalid of ['IT-5106', 'IT-3306', 'Room 101', 'IT-310', 'CS-3106']) {
    assert.throws(() => normalizeAcademicBlock(invalid), DomainValidationError);
  }
});

test('createFacilityDraft preserves nullable capacity and category-based reservability', () => {
  const adminOffice = createFacilityDraft({
    code: 'CICS-1F-DEAN',
    name: "Dean's Office",
    category: 'Administrative',
    building: 'CICS Building',
    floor: 'First Floor',
    capacity: '',
    description: 'Administrative office for college leadership on the first floor.',
    status: 'Restricted',
    isReservable: false,
  });
  assert.equal(adminOffice.capacity, null);
  assert.equal(adminOffice.isReservable, false);

  const learningRoom = createFacilityDraft({
    code: 'CICS-301',
    name: 'Room 301',
    category: 'Learning',
    building: 'CICS Building',
    floor: 'Third Floor',
    capacity: null,
    description: 'Third floor instructional lecture room inside CICS Building.',
  });
  assert.equal(learningRoom.capacity, null);
  assert.equal(learningRoom.isReservable, true);
});

test('assertReservationValid handles nullable capacity, blocks non-reservable/archived facilities, and normalizes academicBlock', () => {
  const unmeasuredLearningRoom = {
    ...sampleFacility,
    capacity: null,
  };
  const validBooking = assertReservationValid({
    facility: unmeasuredLearningRoom,
    existingReservations: [],
    reservationDate: '2026-11-20',
    startTime: '09:00',
    endTime: '11:00',
    attendeesCount: 40,
    purpose: 'IT 314 Web Systems lecture session',
    academicBlock: 'it-3106',
    userRole: 'professor',
    todayIso: '2026-11-16',
  });
  assert.equal(validBooking.academicBlock, 'IT-3106');

  const nonReservableRoom = {
    ...sampleFacility,
    id: 20,
    category: 'Administrative',
    isReservable: false,
  };
  assert.throws(
    () =>
      assertReservationValid({
        facility: nonReservableRoom,
        existingReservations: [],
        reservationDate: '2026-11-20',
        startTime: '09:00',
        endTime: '11:00',
        attendeesCount: 2,
        purpose: 'Faculty consultation',
        userRole: 'admin',
        todayIso: '2026-11-16',
      }),
    ConflictError
  );

  const archivedFacility = {
    ...sampleFacility,
    id: 21,
    isArchived: true,
  };
  assert.throws(
    () =>
      assertReservationValid({
        facility: archivedFacility,
        existingReservations: [],
        reservationDate: '2026-11-20',
        startTime: '09:00',
        endTime: '11:00',
        attendeesCount: 5,
        purpose: 'Study session',
        userRole: 'admin',
        todayIso: '2026-11-16',
      }),
    ConflictError
  );
});

test('computeDashboardMetrics and computeAdminAnalytics exclude archived facilities and support floor filtering', () => {
  const floorTwoRoom = {
    ...sampleFacility,
    id: 2,
    code: 'CICS-201',
    name: 'Room 201',
    floor: 'Second Floor',
  };
  const archivedLegacyRoom = {
    ...sampleFacility,
    id: 99,
    code: 'LEGACY-101',
    name: 'Legacy Space',
    floor: 'First Floor',
    isArchived: true,
    isReservable: false,
  };

  const reservations = [
    {
      id: 1,
      facilityId: 1,
      userId: 5,
      reservationDate: '2026-11-20',
      startTime: '09:00',
      endTime: '11:00',
      status: 'Confirmed',
    },
    {
      id: 2,
      facilityId: 2,
      userId: 5,
      reservationDate: '2026-11-20',
      startTime: '13:00',
      endTime: '15:00',
      status: 'Pending',
    },
    {
      id: 3,
      facilityId: 99,
      userId: 5,
      reservationDate: '2026-11-10',
      startTime: '10:00',
      endTime: '12:00',
      status: 'Confirmed',
    },
  ];
  const issues = [
    { id: 1, facilityId: 1, reporterId: 5, category: 'Equipment', priority: 'Medium', status: 'Open' },
    { id: 2, facilityId: 99, reporterId: 5, category: 'Other', priority: 'Low', status: 'Open' },
  ];

  const metrics = computeDashboardMetrics({
    reservations,
    issues,
    facilities: [sampleFacility, floorTwoRoom, archivedLegacyRoom],
    user: { id: 5, role: 'student' },
    todayIso: '2026-11-16',
  });
  assert.equal(metrics.totalFacilitiesCount, 2);
  assert.equal(metrics.totalReservations, 2);
  assert.equal(metrics.openIssues, 1);

  const secondFloorAnalytics = computeAdminAnalytics({
    reservations,
    issues,
    facilities: [sampleFacility, floorTwoRoom, archivedLegacyRoom],
    users: [{ id: 1, role: 'admin' }],
    filters: { floor: 'Second Floor' },
  });
  assert.equal(secondFloorAnalytics.totals.facilities, 1);
  assert.equal(secondFloorAnalytics.totals.reservations, 1);
  assert.equal(secondFloorAnalytics.facilityBreakdown[0].code, 'CICS-201');
  assert.deepEqual(secondFloorAnalytics.floorsAvailable, ['First Floor', 'Second Floor']);
});

test('validatePasswordStrength and assertRegistrationRoleAllowed enforce password complexity and block admin self-registration', () => {
  assert.throws(() => validatePasswordStrength('short1A'), DomainValidationError);
  assert.throws(() => validatePasswordStrength('alllowercase123'), DomainValidationError);
  assert.throws(() => validatePasswordStrength('ALLUPPERCASE123'), DomainValidationError);
  assert.throws(() => validatePasswordStrength('NoDigitsHere'), DomainValidationError);
  assert.equal(validatePasswordStrength('CampusPass2026'), 'CampusPass2026');

  assert.equal(assertRegistrationRoleAllowed('student'), 'student');
  assert.equal(assertRegistrationRoleAllowed('PROFESSOR'), 'professor');
  assert.throws(() => assertRegistrationRoleAllowed('admin'), DomainValidationError);
  assert.throws(() => assertRegistrationRoleAllowed('superadmin'), DomainValidationError);
});

test('passwordHasher uses salted scrypt hashes and deterministic SHA-256 verification token hashing', () => {
  const hash1 = hashPassword('BatStateU2026');
  const hash2 = hashPassword('BatStateU2026');
  assert.notEqual(hash1, hash2); // unique random salt per password
  assert.ok(hash1.startsWith('scrypt$'));
  assert.equal(verifyPassword('BatStateU2026', hash1), true);
  assert.equal(verifyPassword('WrongPass2026', hash1), false);
  assert.equal(verifyPassword('BatStateU2026', 'not-a-valid-hash'), false);

  const tokenObj = generateVerificationToken();
  assert.ok(tokenObj.rawToken.length >= 32);
  assert.equal(hashVerificationToken(tokenObj.rawToken), tokenObj.tokenHash);
});

test('reservation and maintenance workflows notify both requester and active administrators with read-state updates', async () => {
  const tmpStore = path.join(os.tmpdir(), `facicuse-notif-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  try {
    const adapters = createLocalStoreAdapters({ storeFilePath: tmpStore });
    const reservationUseCases = createReservationUseCases({
      reservationRepo: adapters.reservationRepo,
      facilityRepo: adapters.facilityRepo,
      userRepo: adapters.userRepo,
      notificationPort: adapters.notificationPort,
      auditLogPort: adapters.auditLogPort,
    });
    const maintenanceUseCases = createMaintenanceUseCases({
      issueRepo: adapters.issueRepo,
      facilityRepo: adapters.facilityRepo,
      userRepo: adapters.userRepo,
      notificationPort: adapters.notificationPort,
      auditLogPort: adapters.auditLogPort,
    });

    const initialUsers = await adapters.userRepo.listAll();
    assert.equal(initialUsers.length, 0);

    const student = await adapters.userRepo.upsertVerifiedUser({
      uid: 'test-student-uid',
      email: 'student.tester@g.batstate-u.edu.ph',
      fullName: 'Student Tester',
      role: 'student',
      department: 'CICS',
    });
    const admin = await adapters.userRepo.upsertVerifiedUser({
      uid: 'test-admin-uid',
      email: 'admin.tester@batstate-u.edu.ph',
      fullName: 'Admin Tester',
      role: 'admin',
      department: 'CICS Building Operations',
    });
    const facilities = await adapters.facilityRepo.listAll();
    assert.equal(facilities.length, 38);
    const room = facilities.find((f) => f.isReservable !== false && f.status === 'Available');

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await reservationUseCases.createReservationRequest(student, {
      facilityId: room.id,
      reservationDate: tomorrow,
      startTime: '09:00',
      endTime: '11:00',
      attendeesCount: 10,
      purpose: 'Notification fan-out test session',
    });

    await maintenanceUseCases.submitMaintenanceIssue(student, {
      facilityId: room.id,
      title: 'Loose wall outlet cover',
      category: 'Electrical',
      priority: 'High',
      description: 'Wall outlet cover plate near row 2 is loose.',
    });

    const studentNotifs = await adapters.notificationPort.listByUserId(student.id);
    const adminNotifs = await adapters.notificationPort.listByUserId(admin.id);

    assert.equal(studentNotifs.length, 2);
    assert.equal(adminNotifs.length, 2);
    assert.ok(adminNotifs.some((n) => n.title.includes('Reservation Pending Review')));
    assert.ok(adminNotifs.some((n) => n.title.includes('High Maintenance Report')));

    await adapters.notificationPort.markAsRead(admin.id, adminNotifs[0].id);
    const afterSingleRead = await adapters.notificationPort.listByUserId(admin.id);
    assert.equal(afterSingleRead.filter((n) => !n.isRead).length, 1);

    await adapters.notificationPort.markAllAsRead(admin.id);
    const afterMarkAll = await adapters.notificationPort.listByUserId(admin.id);
    assert.equal(afterMarkAll.filter((n) => !n.isRead).length, 0);
  } finally {
    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  }
});

test('authenticateWithEmailPassword enforces university email domains and rejects invalid credentials', async () => {
  const tmpStore = path.join(os.tmpdir(), `facicuse-auth-login-${Date.now()}.json`);
  try {
    const adapters = createLocalStoreAdapters(tmpStore);
    const domainPolicy = new EmailDomainPolicy(DEFAULT_UNIVERSITY_DOMAINS);
    const userUseCases = createUserUseCases({
      userRepo: adapters.userRepo,
      auditLogPort: adapters.auditLogPort,
      domainPolicy,
      passwordHasher: { hashPassword, verifyPassword },
      adminBootstrapEmails: ['bootstrap.admin@example.org'],
    });

    await assert.rejects(
      () =>
        userUseCases.authenticateWithEmailPassword({
          email: 'outsider@gmail.com',
          password: 'Password123!',
        }),
      (err) => err instanceof DomainValidationError && /verified university domains/i.test(err.message)
    );

    await assert.rejects(
      () =>
        userUseCases.authenticateWithEmailPassword({
          email: 'unknown.student@g.batstate-u.edu.ph',
          password: 'WrongPassword123!',
        }),
      (err) => err instanceof DomainError && err.code === 'INVALID_CREDENTIALS'
    );
  } finally {
    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  }
});

test('resolvePostLoginPath and validateUniversityEmailInput enforce role boundaries and safe redirects', () => {
  assert.equal(resolvePostLoginPath({ role: 'student' }, '/app/calendar'), '/app/calendar');
  assert.equal(resolvePostLoginPath({ role: 'student' }, '/app/admin/analytics'), '/app/dashboard');
  assert.equal(resolvePostLoginPath({ role: 'professor' }, '/app/admin/users'), '/app/dashboard');
  assert.equal(resolvePostLoginPath({ role: 'admin' }, '/app/admin/analytics'), '/app/admin/analytics');
  assert.equal(resolvePostLoginPath({ role: 'admin' }, 'https://evil.example/steal'), '/app/dashboard');
  assert.equal(resolvePostLoginPath({ role: 'student' }, '//evil.example'), '/app/dashboard');

  const ok = validateUniversityEmailInput('  juan.delacruz@g.batstate-u.edu.ph ', DEFAULT_UNIVERSITY_DOMAINS);
  assert.equal(ok.valid, true);
  assert.equal(ok.email, 'juan.delacruz@g.batstate-u.edu.ph');

  const badDomain = validateUniversityEmailInput('visitor@gmail.com', DEFAULT_UNIVERSITY_DOMAINS);
  assert.equal(badDomain.valid, false);
  assert.match(badDomain.error, /university email domains/i);
});

test('validateRuntimeConfig enforces PostgreSQL and SESSION_SECRET in production and has no personal admin default', () => {
  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        SESSION_SECRET: 'super-secret-production-key-32chars',
      }),
    /PostgreSQL configuration is incomplete/i
  );

  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        SQL_HOST: '127.0.0.1',
        SQL_DB_NAME: 'facicuse',
        SQL_USER: 'postgres',
        SQL_PASSWORD: 'CHANGE_ME_PASSWORD',
        SESSION_SECRET: 'super-secret-production-key-32chars',
      }),
    /SQL_PASSWORD/i
  );

  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        SQL_HOST: '127.0.0.1',
        SQL_DB_NAME: 'facicuse',
        SQL_USER: 'postgres',
        SQL_PASSWORD: 'real-db-password',
        SESSION_SECRET: 'short',
      }),
    /SESSION_SECRET/i
  );

  const prodConfig = validateRuntimeConfig({
    NODE_ENV: 'production',
    SQL_HOST: '10.0.0.5',
    SQL_DB_NAME: 'facicuse_prod',
    SQL_USER: 'facicuse_app',
    SQL_PASSWORD: 'real-db-password',
    SESSION_SECRET: 'production-grade-secret-key-2026',
  });
  assert.equal(prodConfig.storageMode, 'postgres');
  assert.equal(prodConfig.isProduction, true);
  assert.deepEqual(prodConfig.adminBootstrapEmails, []);

  const devConfig = validateRuntimeConfig({ NODE_ENV: 'development' });
  assert.equal(devConfig.storageMode, 'local');
  assert.deepEqual(devConfig.adminBootstrapEmails, []);
});

test('computeAdminAnalytics and computeDashboardMetrics exclude any legacy isDemo records', () => {
  const reservations = [
    {
      id: 1,
      facilityId: 1,
      userId: 5,
      reservationDate: '2026-11-20',
      startTime: '09:00',
      endTime: '11:00',
      status: 'Confirmed',
      isDemo: false,
    },
    {
      id: 2,
      facilityId: 1,
      userId: 5,
      reservationDate: '2026-11-21',
      startTime: '13:00',
      endTime: '15:00',
      status: 'Confirmed',
      isDemo: true,
    },
  ];
  const issues = [
    { id: 1, facilityId: 1, reporterId: 5, category: 'HVAC', priority: 'High', status: 'Open', isDemo: false },
    { id: 2, facilityId: 1, reporterId: 5, category: 'Audio/Visual', priority: 'Low', status: 'Open', isDemo: true },
  ];
  const facilities = [
    { ...sampleFacility, id: 1, isDemo: false },
    { ...sampleFacility, id: 2, code: 'DEMO-999', isDemo: true },
  ];
  const users = [
    { id: 5, role: 'student', isDemo: false },
    { id: 6, role: 'student', isDemo: true },
  ];

  const dashboard = computeDashboardMetrics({
    reservations,
    issues,
    facilities,
    user: { id: 5, role: 'student' },
    todayIso: '2026-11-16',
  });
  assert.equal(dashboard.totalFacilitiesCount, 1);
  assert.equal(dashboard.totalReservations, 1);
  assert.equal(dashboard.openIssues, 1);

  const analytics = computeAdminAnalytics({
    reservations,
    issues,
    facilities,
    users,
  });
  assert.equal(analytics.totals.facilities, 1);
  assert.equal(analytics.totals.reservations, 1);
  assert.equal(analytics.totals.issues, 1);
  assert.equal(analytics.totals.users, 1);
});

test('localStoreRepositories filter out any legacy isDemo records when reading from disk', async () => {
  const tmpStore = path.join(os.tmpdir(), `facicuse-legacy-demo-${Date.now()}.json`);
  try {
    fs.writeFileSync(
      tmpStore,
      JSON.stringify({
        counters: { users: 2, facilities: 2, reservations: 2, maintenanceIssues: 2, notifications: 0, auditLogs: 0 },
        users: [
          { id: 1, uid: 'real-1', email: 'real@g.batstate-u.edu.ph', fullName: 'Real User', role: 'student', isActive: true, isDemo: false },
          { id: 2, uid: 'demo-1', email: 'demo@g.batstate-u.edu.ph', fullName: 'Legacy Demo', role: 'admin', isActive: true, isDemo: true },
        ],
        facilities: [
          { ...sampleFacility, id: 1, isDemo: false },
          { ...sampleFacility, id: 2, code: 'DEMO-1', isDemo: true },
        ],
        reservations: [
          { id: 1, facilityId: 1, userId: 1, reservationDate: '2026-11-20', startTime: '09:00', endTime: '11:00', status: 'Confirmed', isDemo: false },
          { id: 2, facilityId: 1, userId: 2, reservationDate: '2026-11-20', startTime: '13:00', endTime: '15:00', status: 'Confirmed', isDemo: true },
        ],
        maintenanceIssues: [
          { id: 1, facilityId: 1, reporterId: 1, title: 'Real issue', status: 'Open', isDemo: false },
          { id: 2, facilityId: 1, reporterId: 2, title: 'Legacy demo issue', status: 'Open', isDemo: true },
        ],
        notifications: [],
        auditLogs: [],
      }),
      'utf8'
    );

    const adapters = createLocalStoreAdapters({ storeFilePath: tmpStore });
    const users = await adapters.userRepo.listAll();
    const reservations = await adapters.reservationRepo.listAll();
    const issues = await adapters.issueRepo.listAll();
    const facilities = await adapters.facilityRepo.listAll();

    assert.equal(users.length, 1);
    assert.equal(users[0].email, 'real@g.batstate-u.edu.ph');
    assert.equal(reservations.length, 1);
    assert.equal(issues.length, 1);
    assert.equal(facilities.some((f) => f.isDemo === true), false);
  } finally {
    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  }
});

test('resolveFacilityImageUrl prefers explicit facility imageUrl and falls back cleanly by category', () => {
  assert.equal(
    resolveFacilityImageUrl({ code: 'CICS-101', category: 'Learning', imageUrl: '/assets/images/custom-101.jpg' }),
    '/assets/images/custom-101.jpg'
  );
  assert.equal(
    resolveFacilityImageUrl({ code: 'CICS-1F-DEAN', category: 'Administrative' }),
    DEFAULT_FACILITY_MEDIA.smartRoom
  );
  assert.equal(
    resolveFacilityImageUrl({ code: 'CICS-1F-CR', category: 'Support' }),
    DEFAULT_FACILITY_MEDIA.building
  );
  assert.equal(
    resolveFacilityImageUrl({ code: 'CICS-101', category: 'Learning' }),
    '/assets/images/facilities/1st Floor/Room 101.jpeg'
  );
  assert.equal(
    resolveFacilityImageUrl({ code: 'CICS-UNKNOWN', category: 'Learning' }),
    DEFAULT_FACILITY_MEDIA.classroom
  );
});




