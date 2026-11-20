import { DomainValidationError } from './errors.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toMinutes(timeStr) {
  const match = TIME_PATTERN.exec(String(timeStr || '').trim());
  if (!match) {
    throw new DomainValidationError(`Invalid 24-hour time format "${timeStr}". Expected HH:MM.`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export class TimeSlot {
  constructor(date, startTime, endTime) {
    const cleanDate = String(date || '').trim();
    if (!DATE_PATTERN.test(cleanDate)) {
      throw new DomainValidationError('Reservation date must follow YYYY-MM-DD format.');
    }

    const parsedDate = new Date(`${cleanDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new DomainValidationError('Reservation date is invalid.');
    }

    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);

    if (endMinutes <= startMinutes) {
      throw new DomainValidationError('End time must be after start time.');
    }
    if (endMinutes - startMinutes < 30) {
      throw new DomainValidationError('Minimum reservation duration is 30 minutes.');
    }
    if (endMinutes - startMinutes > 480) {
      throw new DomainValidationError('Single reservations cannot exceed 8 hours.');
    }

    this.date = cleanDate;
    this.startTime = String(startTime).trim();
    this.endTime = String(endTime).trim();
    this.startMinutes = startMinutes;
    this.endMinutes = endMinutes;
  }

  durationHours() {
    return (this.endMinutes - this.startMinutes) / 60;
  }

  overlapsWith(otherSlot) {
    if (this.date !== otherSlot.date) return false;
    return this.startMinutes < otherSlot.endMinutes && otherSlot.startMinutes < this.endMinutes;
  }

  isWithinOperatingHours(openHour, closeHour) {
    const openMin = toMinutes(openHour);
    const closeMin = toMinutes(closeHour);
    return this.startMinutes >= openMin && this.endMinutes <= closeMin;
  }
}

export class EmailDomainPolicy {
  constructor(allowedDomainsCsv = '') {
    this.allowedDomains = String(allowedDomainsCsv || '')
      .split(',')
      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
  }

  isConfigured() {
    return this.allowedDomains.length > 0;
  }

  assertEmailAllowed(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      throw new DomainValidationError('A valid email address is required.');
    }
    if (!this.isConfigured()) {
      return normalized;
    }
    const domain = normalized.split('@')[1];
    if (!this.allowedDomains.includes(domain)) {
      throw new DomainValidationError(
        `Access is restricted to verified university domains: ${this.allowedDomains.join(', ')}.`
      );
    }
    return normalized;
  }
}

const ACADEMIC_BLOCK_PATTERN = /^IT-([1-4])([12])(\d{2})$/;
const YEAR_LABELS = Object.freeze({
  1: '1st Year',
  2: '2nd Year',
  3: '3rd Year',
  4: '4th Year',
});
const SEMESTER_LABELS = Object.freeze({
  1: '1st Semester',
  2: '2nd Semester',
});

export function normalizeAcademicBlock(rawBlock) {
  if (rawBlock === undefined || rawBlock === null) return null;
  const trimmed = String(rawBlock).trim().toUpperCase();
  if (!trimmed) return null;
  if (!ACADEMIC_BLOCK_PATTERN.test(trimmed)) {
    throw new DomainValidationError(
      'Academic block must follow the BSIT format IT-<Year 1-4><Sem 1-2><Block>, e.g. IT-1109, IT-2109, IT-3106, or IT-4106.'
    );
  }
  return trimmed;
}

export const DEFAULT_UNIVERSITY_DOMAINS = Object.freeze([
  'g.batstate-u.edu.ph',
  'batstate-u.edu.ph',
]);

export function validatePasswordStrength(password) {
  const raw = String(password ?? '');
  if (raw.length < 8 || raw.length > 128) {
    throw new DomainValidationError('Password must be between 8 and 128 characters.');
  }
  if (!/[a-z]/.test(raw) || !/[A-Z]/.test(raw) || !/\d/.test(raw)) {
    throw new DomainValidationError(
      'Password must include at least one uppercase letter, one lowercase letter, and one number.'
    );
  }
  return raw;
}

export function assertRegistrationRoleAllowed(rawRole) {
  const role = String(rawRole || 'student').trim().toLowerCase();
  if (role !== 'student' && role !== 'professor') {
    throw new DomainValidationError(
      'Self-registration is restricted to Student and Professor accounts. Administrator access must be granted by a System Administrator.'
    );
  }
  return role;
}

export function parseAcademicBlockInfo(rawBlock) {
  const code = normalizeAcademicBlock(rawBlock);
  if (!code) return null;
  const match = ACADEMIC_BLOCK_PATTERN.exec(code);
  const yearLevel = Number(match[1]);
  const semester = Number(match[2]);
  const blockNumber = match[3];
  return {
    code,
    program: 'BSIT',
    yearLevel,
    yearLabel: YEAR_LABELS[yearLevel],
    semester,
    semesterLabel: SEMESTER_LABELS[semester],
    blockNumber,
  };
}


