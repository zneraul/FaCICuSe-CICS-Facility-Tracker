export const VERIFICATION_STATUS = Object.freeze({
  SUPPLIED_UNVERIFIED: 'SUPPLIED_UNVERIFIED',
  ADMIN_VERIFIED: 'ADMIN_VERIFIED',
});

export const ALL_WEEKDAYS = Object.freeze([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]);

export const NON_INSTRUCTIONAL_WEEKDAYS = Object.freeze(['Friday']);

export const ALLOWED_WEEKDAYS = Object.freeze(
  ALL_WEEKDAYS.filter((day) => !NON_INSTRUCTIONAL_WEEKDAYS.includes(day))
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

export const CLASS_OPERATING_HOURS = Object.freeze({
  openHour: '07:00',
  closeHour: '21:00',
});

export const CLASS_SCHEDULES_DIRTY_EVENT = 'facicuse:class-schedules-dirty';

export function emitClassSchedulesDirty() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLASS_SCHEDULES_DIRTY_EVENT));
  }
}

export function formatVerificationLabel(status) {
  return status === VERIFICATION_STATUS.ADMIN_VERIFIED
    ? 'Admin Verified'
    : 'Supplied / Unverified';
}

export function formatTimeRange(startTime, endTime) {
  return `${startTime || '--:--'}–${endTime || '--:--'}`;
}

export function getWeekdayFromIsoDate(isoDate) {
  const trimmed = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return '';
  const dt = new Date(`${trimmed}T12:00:00+08:00`);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
  }).format(dt);
}

const ONLINE_STANDALONE_PATTERN = /(?:^|[\s\-/(\[:,;])(?:ONLINE|OL)(?:$|[\s\-/)\]:,;])/i;

export function hasOnlineTokenClient(value) {
  const str = String(value || '').trim();
  if (!str) return false;
  return ONLINE_STANDALONE_PATTERN.test(str);
}

function toMinutesClient(hhmm) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function validateClassScheduleFormClient(form, { nonInstructionalWeekdays = NON_INSTRUCTIONAL_WEEKDAYS } = {}) {
  const section = String(form.section || '').trim();
  const subjectCode = String(form.subjectCode || '').trim();
  const dayOfWeek = String(form.dayOfWeek || '').trim();
  const startTime = String(form.startTime || '').trim();
  const endTime = String(form.endTime || '').trim();

  if (!section || section.length < 2) {
    return 'Section / Program is required (e.g. IT-3106).';
  }
  if (!subjectCode || subjectCode.length < 2) {
    return 'Subject Code is required (e.g. IT 314).';
  }
  if (hasOnlineTokenClient(section) || hasOnlineTokenClient(subjectCode)) {
    return 'Online-only classes (ONLINE / OL) cannot be registered as in-person CICS facility schedules.';
  }
  if (!ALL_WEEKDAYS.includes(dayOfWeek)) {
    return 'Select a valid instructional weekday (Monday–Thursday or Saturday).';
  }
  if (nonInstructionalWeekdays.includes(dayOfWeek)) {
    return `${dayOfWeek} is configured as a non-instructional rest day and cannot accept recurring in-person class schedules.`;
  }

  const startMins = toMinutesClient(startTime);
  const endMins = toMinutesClient(endTime);
  const openMins = toMinutesClient(CLASS_OPERATING_HOURS.openHour);
  const closeMins = toMinutesClient(CLASS_OPERATING_HOURS.closeHour);

  if (startMins === null || endMins === null) {
    return 'Start time and end time must use 24-hour HH:MM format.';
  }
  if (startMins < openMins || endMins > closeMins) {
    return `Class schedule hours must fall within CICS operating hours (${CLASS_OPERATING_HOURS.openHour}–${CLASS_OPERATING_HOURS.closeHour}).`;
  }
  if (endMins <= startMins) {
    return 'End time must be strictly later than start time.';
  }
  if (
    form.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED &&
    !form.confirmVerified
  ) {
    return 'Please confirm administrator verification before marking this schedule as Admin Verified.';
  }
  return null;
}
