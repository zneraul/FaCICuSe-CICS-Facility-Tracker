import test from 'node:test';
import assert from 'node:assert/strict';
import { createFacilityUseCases } from './facilityUseCases.js';

const facility = {
  id: 7,
  code: 'CICS-101',
  name: 'Testing Laboratory',
  category: 'Laboratory',
  building: 'CICS Building',
  floor: 'First Floor',
  capacity: 30,
  description: 'A test facility.',
  amenities: ['Whiteboard'],
  status: 'Available',
  allowedRoles: 'student,professor,admin',
  openHour: '08:00',
  closeHour: '20:00',
  isReservable: true,
  isArchived: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

for (const role of ['student', 'professor']) {
  test(`facility detail for ${role} does not fetch or expose maintenance reports`, async () => {
    let issueListCalls = 0;
    const useCases = createFacilityUseCases({
      facilityRepo: {
        async findById(id) {
          assert.equal(id, facility.id);
          return facility;
        },
      },
      reservationRepo: {
        async listByFacilityAndDate() {
          return [];
        },
      },
      classScheduleRepo: {
        async listByFacilityAndDay() {
          return [];
        },
      },
      // Keep a tripwire so this test fails if facility details start querying
      // the enriched maintenance-report repository again.
      issueRepo: {
        async listAll() {
          issueListCalls += 1;
          throw new Error('Facility detail must not fetch maintenance reports.');
        },
      },
      auditLogPort: {},
    });

    const detail = await useCases.getFacilityDetailForUser(
      { id: 42, role },
      facility.id,
      '2026-11-23'
    );

    assert.equal(issueListCalls, 0);
    assert.equal(Object.hasOwn(detail, 'activeIssues'), false);
    assert.equal(detail.facility.id, facility.id);
    assert.deepEqual(detail.schedule, []);
    assert.deepEqual(detail.classSchedules, []);
  });
}
