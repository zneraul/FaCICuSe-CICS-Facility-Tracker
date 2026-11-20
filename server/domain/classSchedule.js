/**
 * Recurring Academic Class Schedule Domain Model & Pure Business Rules.
 *
 * Pure Hexagonal Domain Module — zero Express, React, or Drizzle/DB dependencies.
 */

import { FacilityStatus } from './entities.js';
import { ConflictError, DomainValidationError } from './errors.js';
import { toMinutes } from './valueObjects.js';

export const MANILA_TIMEZONE = 'Asia/Manila';

export const ALL_CLASS_WEEKDAYS = Object.freeze([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

/**
 * Maintainable campus-configured non-instructional / rest days for recurring in-person classes.
 * Update this list if institutional scheduling policy changes.
 */
export const NON_INSTRUCTIONAL_WEEKDAYS = Object.freeze(['Friday']);

export const ALLOWED_CLASS_WEEKDAYS = Object.freeze(
  ALL_CLASS_WEEKDAYS.filter((day) => !NON_INSTRUCTIONAL_WEEKDAYS.includes(day))
);

export const WEEKDAY_ORDER = Object.freeze({
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
});

export const CLASS_SCHEDULE_OPERATING_HOURS = Object.freeze({
  openHour: '07:00',
  closeHour: '21:00',
});

export const ClassScheduleVerificationStatus = Object.freeze({
  SUPPLIED_UNVERIFIED: 'SUPPLIED_UNVERIFIED',
  ADMIN_VERIFIED: 'ADMIN_VERIFIED',
});

export const ClassScheduleSource = Object.freeze({
  SUPPLIED_INITIAL_DATASET: 'SUPPLIED_INITIAL_DATASET',
  ADMIN_MANUAL: 'ADMIN_MANUAL',
  IMPORTED_SUPPLIED: 'IMPORTED_SUPPLIED',
});

/**
 * Approved initial recurring class schedule dataset supplied for section IT-3106.
 * All entries retain SUPPLIED_UNVERIFIED status until reviewed by an authorized administrator.
 */
export const INITIAL_IT3106_CLASS_SCHEDULES = Object.freeze([
  Object.freeze({
    seedKey: 'it-3106:monday:0800-0900:it-314',
    section: 'IT-3106',
    dayOfWeek: 'Monday',
    startTime: '08:00',
    endTime: '09:00',
    subjectCode: 'IT 314',
    requestedFacilityName: 'Room 105',
    canonicalFacilityCode: 'CICS-105',
  }),
  Object.freeze({
    seedKey: 'it-3106:monday:1000-1100:bat-401',
    section: 'IT-3106',
    dayOfWeek: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
    subjectCode: 'BAT 401',
    requestedFacilityName: 'Room 106',
    canonicalFacilityCode: 'CICS-106',
  }),
  Object.freeze({
    seedKey: 'it-3106:monday:1300-1400:it-313',
    section: 'IT-3106',
    dayOfWeek: 'Monday',
    startTime: '13:00',
    endTime: '14:00',
    subjectCode: 'IT 313',
    requestedFacilityName: 'Room 106',
    canonicalFacilityCode: 'CICS-106',
  }),
  Object.freeze({
    seedKey: 'it-3106:monday:1600-1700:it-312',
    section: 'IT-3106',
    dayOfWeek: 'Monday',
    startTime: '16:00',
    endTime: '17:00',
    subjectCode: 'IT 312',
    requestedFacilityName: 'Computer Lab 2',
    canonicalFacilityCode: 'CICS-LAB2',
  }),
  Object.freeze({
    seedKey: 'it-3106:wednesday:1300-1400:bat-401',
    section: 'IT-3106',
    dayOfWeek: 'Wednesday',
    startTime: '13:00',
    endTime: '14:00',
    subjectCode: 'BAT 401',
    requestedFacilityName: 'IT Laboratory',
    canonicalFacilityCode: 'CICS-4F-ITL',
  }),
]);

/**
 * Verified canonical alias lookup strictly for exact abbreviated names in the supplied CICS dataset.
 */
const VERIFIED_FACILITY_ALIASES = Object.freeze({
  'room 105': 'CICS-105',
  'room 106': 'CICS-106',
  'computer lab 2': 'CICS-LAB2',
  'computer laboratory 2': 'CICS-LAB2',
  'it laboratory': 'CICS-4F-ITL',
  'information technology laboratory': 'CICS-4F-ITL',
});

export function formatVerificationStatusLabel(status) {
  if (status === ClassScheduleVerificationStatus.ADMIN_VERIFIED) {
    return 'Admin Verified';
  }
  return 'Supplied / Unverified';
}

export function normalizeVerificationStatus(rawStatus) {
  const normalized = String(rawStatus || '')
    .trim()
    .toUpperCase()
    .replace(/[\s/]+/g, '_');

  if (
    normalized === ClassScheduleVerificationStatus.ADMIN_VERIFIED ||
    normalized === 'VERIFIED'
  ) {
    return ClassScheduleVerificationStatus.ADMIN_VERIFIED;
  }
  if (
    !normalized ||
    normalized === ClassScheduleVerificationStatus.SUPPLIED_UNVERIFIED ||
    normalized === 'UNVERIFIED' ||
    normalized === 'SUPPLIED'
  ) {
    return ClassScheduleVerificationStatus.SUPPLIED_UNVERIFIED;
  }

  throw new DomainValidationError(
    `Invalid verification status "${rawStatus}". Expected SUPPLIED_UNVERIFIED or ADMIN_VERIFIED.`
  );
}

export function getManilaTodayIso(date = new Date()) {
  const dt = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function getManilaWeekday(dateOrIso = new Date()) {
  if (typeof dateOrIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrIso.trim())) {
    // Anchor at 12:00 Asia/Manila (+08:00) so the calendar date never shifts across UTC boundaries
    const parsed = new Date(`${dateOrIso.trim()}T12:00:00+08:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new DomainValidationError(`Invalid calendar date "${dateOrIso}".`);
    }
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIMEZONE,
      weekday: 'long',
    }).format(parsed);
  }
  const dt = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (Number.isNaN(dt.getTime())) {
    throw new DomainValidationError('Invalid date supplied for Manila weekday lookup.');
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIMEZONE,
    weekday: 'long',
  }).format(dt);
}

export function normalizeClassSection(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!cleaned) {
    throw new DomainValidationError('Section / Program is required (e.g. IT-3106).');
  }
  if (cleaned.length < 2 || cleaned.length > 40) {
    throw new DomainValidationError('Section / Program must be between 2 and 40 characters.');
  }
  return cleaned;
}

export function normalizeSubjectCode(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  if (!cleaned) {
    throw new DomainValidationError('Subject Code is required (e.g. IT 314).');
  }
  if (cleaned.length < 2 || cleaned.length > 40) {
    throw new DomainValidationError('Subject Code must be between 2 and 40 characters.');
  }
  return cleaned;
}

export function normalizeDayOfWeek(rawDay) {
  const trimmed = String(rawDay || '').trim();
  const matched = ALL_CLASS_WEEKDAYS.find(
    (day) => day.toLowerCase() === trimmed.toLowerCase()
  );

  if (!matched) {
    throw new DomainValidationError(
      `Invalid day of week "${rawDay || ''}". Recurring class schedules must fall on an instructional weekday (${ALLOWED_CLASS_WEEKDAYS.join(', ')}).`
    );
  }

  if (NON_INSTRUCTIONAL_WEEKDAYS.includes(matched)) {
    throw new DomainValidationError(
      `${matched} is configured as a non-instructional rest day and cannot accept recurring in-person class schedules.`
    );
  }

  return matched;
}

/**
 * Detects online-only class schedule designations (ONLINE or OL as standalone tokens or modality flags)
 * without falsely rejecting legitimate subject codes that merely contain the substring "ol"
 * (such as BIOL 101, POLSCI 101, or SOL 201).
 */
const ONLINE_STANDALONE_PATTERN = /(?:^|[\s\-/(\[:,;])(?:ONLINE|OL)(?:$|[\s\-/)\]:,;])/i;

export function hasOnlineOnlyDesignation(input = {}) {
  const fieldsToInspect = [
    input.modality,
    input.deliveryMode,
    input.scheduleType,
    input.facilityName,
    input.roomLabel,
    input.subjectCode,
    input.section,
    input.notes,
  ];

  for (const field of fieldsToInspect) {
    const val = String(field || '').trim();
    if (!val) continue;
    if (ONLINE_STANDALONE_PATTERN.test(val)) {
      return true;
    }
  }
  return false;
}

export function isEligibleClassScheduleFacility(facility) {
  if (!facility) return false;
  if (facility.isArchived) return false;
  if (facility.category !== 'Learning') return false;
  if (facility.isReservable === false) return false;
  if (facility.status !== FacilityStatus.AVAILABLE) return false;
  return true;
}

export function resolveCanonicalFacilityForSeed(
  { requestedFacilityName, canonicalFacilityCode },
  facilitiesList = []
) {
  const safeList = Array.isArray(facilitiesList) ? facilitiesList : [];
  const normalizedName = String(requestedFacilityName || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const targetCode = String(
    canonicalFacilityCode || VERIFIED_FACILITY_ALIASES[normalizedName] || ''
  )
    .trim()
    .toUpperCase();

  let match = null;
  if (targetCode) {
    match = safeList.find((f) => String(f.code || '').toUpperCase() === targetCode) || null;
  }
  if (!match && normalizedName) {
    match =
      safeList.find(
        (f) => String(f.name || '').trim().toLowerCase() === normalizedName
      ) || null;
  }

  if (!match || !isEligibleClassScheduleFacility(match)) {
    return null;
  }
  return match;
}

export function validateClassScheduleDraft(input, { facility = null } = {}) {
  if (hasOnlineOnlyDesignation(input)) {
    throw new DomainValidationError(
      'Online-only classes (ONLINE / OL) cannot be registered as in-person CICS facility schedules.'
    );
  }

  const section = normalizeClassSection(input.section);
  const subjectCode = normalizeSubjectCode(input.subjectCode);
  const dayOfWeek = normalizeDayOfWeek(input.dayOfWeek);

  const startTime = String(input.startTime || '').trim();
  const endTime = String(input.endTime || '').trim();
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  const openMinutes = toMinutes(CLASS_SCHEDULE_OPERATING_HOURS.openHour);
  const closeMinutes = toMinutes(CLASS_SCHEDULE_OPERATING_HOURS.closeHour);

  if (startMinutes < openMinutes) {
    throw new DomainValidationError(
      `Start time (${startTime}) cannot be earlier than CICS Building opening hours (${CLASS_SCHEDULE_OPERATING_HOURS.openHour}).`
    );
  }
  if (endMinutes > closeMinutes) {
    throw new DomainValidationError(
      `End time (${endTime}) cannot be later than CICS Building closing hours (${CLASS_SCHEDULE_OPERATING_HOURS.closeHour}).`
    );
  }
  if (endMinutes <= startMinutes) {
    throw new DomainValidationError('End time must be strictly later than start time.');
  }

  const rawFacilityId = input.facilityId;
  const isUnspecified =
    rawFacilityId === null ||
    rawFacilityId === undefined ||
    String(rawFacilityId).trim() === '' ||
    String(rawFacilityId).trim().toUpperCase() === 'UNSPECIFIED';

  let resolvedFacilityId = null;
  if (!isUnspecified) {
    const parsedId = Number(rawFacilityId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new DomainValidationError('Selected facility mapping is invalid.');
    }
    if (!facility) {
      throw new DomainValidationError('Mapped facility does not exist in the CICS catalog.');
    }
    if (facility.isArchived) {
      throw new ConflictError(`Facility "${facility.name}" is archived and cannot be assigned.`);
    }
    if (facility.category !== 'Learning') {
      throw new DomainValidationError(
        `Facility "${facility.name}" (${facility.category}) is not an eligible Learning facility.`
      );
    }
    if (facility.isReservable === false) {
      throw new DomainValidationError(
        `Facility "${facility.name}" is marked non-reservable and cannot be assigned to class schedules.`
      );
    }
    if (facility.status !== FacilityStatus.AVAILABLE) {
      throw new ConflictError(
        `Facility "${facility.name}" is currently marked ${facility.status} and cannot be assigned.`
      );
    }
    resolvedFacilityId = facility.id;
  }

  const source = Object.values(ClassScheduleSource).includes(input.source)
    ? input.source
    : ClassScheduleSource.ADMIN_MANUAL;

  let verificationStatus = ClassScheduleVerificationStatus.SUPPLIED_UNVERIFIED;
  if (source === ClassScheduleSource.ADMIN_MANUAL && input.verificationStatus) {
    const requested = normalizeVerificationStatus(input.verificationStatus);
    if (requested === ClassScheduleVerificationStatus.ADMIN_VERIFIED) {
      if (input.confirmVerified === false) {
        throw new DomainValidationError(
          'Administrator confirmation is required before marking a class schedule as Admin Verified.'
        );
      }
      verificationStatus = ClassScheduleVerificationStatus.ADMIN_VERIFIED;
    }
  }

  return {
    section,
    dayOfWeek,
    startTime,
    endTime,
    subjectCode,
    facilityId: resolvedFacilityId,
    verificationStatus,
    source,
  };
}

export function timeRangesOverlap(startA, endA, startB, endB) {
  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Validates duplicate, facility overlap, and section overlap invariants for recurring class schedules.
 */
export function assertNoClassScheduleConflicts(
  candidate,
  existingSchedules = [],
  { ignoreId = null } = {}
) {
  const sameDay = (Array.isArray(existingSchedules) ? existingSchedules : []).filter((row) => {
    if (ignoreId !== null && ignoreId !== undefined && Number(row.id) === Number(ignoreId)) {
      return false;
    }
    return row.dayOfWeek === candidate.dayOfWeek;
  });

  for (const existing of sameDay) {
    const overlaps = timeRangesOverlap(
      candidate.startTime,
      candidate.endTime,
      existing.startTime,
      existing.endTime
    );
    if (!overlaps) continue;

    // 1. Exact duplicate guard
    if (
      existing.section === candidate.section &&
      existing.subjectCode === candidate.subjectCode &&
      existing.startTime === candidate.startTime &&
      existing.endTime === candidate.endTime
    ) {
      throw new ConflictError(
        `Duplicate class schedule: ${existing.section} ${existing.subjectCode} already exists on ${existing.dayOfWeek} (${existing.startTime}–${existing.endTime}).`
      );
    }

    // 2. Facility overlap (only when both have a mapped facility)
    if (
      candidate.facilityId !== null &&
      existing.facilityId !== null &&
      Number(candidate.facilityId) === Number(existing.facilityId)
    ) {
      const facilityLabel = existing.facilityName || existing.facilityCode || `Facility #${existing.facilityId}`;
      throw new ConflictError(
        `Facility conflict on ${existing.dayOfWeek}: ${facilityLabel} is already assigned to ${existing.subjectCode} (${existing.section}) from ${existing.startTime}–${existing.endTime}.`
      );
    }

    // 3. Same section overlap
    if (existing.section === candidate.section) {
      throw new ConflictError(
        `Section conflict on ${existing.dayOfWeek}: ${existing.section} already has ${existing.subjectCode} scheduled from ${existing.startTime}–${existing.endTime}.`
      );
    }
  }
}

/**
 * Checks whether a date-specific facility reservation collides with a mapped recurring class schedule
 * on that date's Asia/Manila weekday. Unspecified (facilityId === null) class schedules never block a room.
 */
export function findReservationClassScheduleConflict({
  facilityId,
  reservationDate,
  startTime,
  endTime,
  classSchedules = [],
}) {
  const numericFacilityId = Number(facilityId);
  if (!numericFacilityId) return null;

  const weekday = getManilaWeekday(reservationDate);
  const matching = (Array.isArray(classSchedules) ? classSchedules : []).filter(
    (schedule) =>
      schedule.facilityId !== null &&
      schedule.facilityId !== undefined &&
      Number(schedule.facilityId) === numericFacilityId &&
      schedule.dayOfWeek === weekday
  );

  for (const schedule of matching) {
    if (timeRangesOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
      return schedule;
    }
  }
  return null;
}

export function assertNoReservationClassScheduleConflict({
  facility,
  reservationDate,
  startTime,
  endTime,
  classSchedules = [],
}) {
  const conflict = findReservationClassScheduleConflict({
    facilityId: facility?.id,
    reservationDate,
    startTime,
    endTime,
    classSchedules,
  });

  if (conflict) {
    const roomLabel = facility?.name || conflict.facilityName || `Facility #${conflict.facilityId}`;
    const statusLabel = formatVerificationStatusLabel(conflict.verificationStatus);
    throw new ConflictError(
      `Recurring class schedule conflict: ${roomLabel} is allocated to ${conflict.subjectCode} (${conflict.section}) every ${conflict.dayOfWeek} from ${conflict.startTime}–${conflict.endTime} (${statusLabel}).`
    );
  }
}

export function sortClassSchedules(schedules = []) {
  return [...(Array.isArray(schedules) ? schedules : [])].sort((a, b) => {
    const dayDiff = (WEEKDAY_ORDER[a.dayOfWeek] || 99) - (WEEKDAY_ORDER[b.dayOfWeek] || 99);
    if (dayDiff !== 0) return dayDiff;
    const startDiff = String(a.startTime || '').localeCompare(String(b.startTime || ''));
    if (startDiff !== 0) return startDiff;
    return String(a.section || '').localeCompare(String(b.section || ''));
  });
}
