import { DomainValidationError } from './errors.js';

export const UserRole = Object.freeze({
  STUDENT: 'student',
  PROFESSOR: 'professor',
  ADMIN: 'admin',
});

export const ALL_USER_ROLES = Object.freeze([
  UserRole.STUDENT,
  UserRole.PROFESSOR,
  UserRole.ADMIN,
]);

export const ReservationStatus = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
});

export const ACTIVE_BLOCKING_STATUSES = Object.freeze([
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
]);

export const IssueStatus = Object.freeze({
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
});

export const IssuePriority = Object.freeze({
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
});

export const FacilityStatus = Object.freeze({
  AVAILABLE: 'Available',
  MAINTENANCE: 'Maintenance',
  RESTRICTED: 'Restricted',
});

export function parseAmenities(rawAmenities) {
  if (Array.isArray(rawAmenities)) {
    return rawAmenities.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof rawAmenities === 'string') {
    const trimmed = rawAmenities.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // Fallback to comma-separated parsing
      }
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseAllowedRoles(rawRoles) {
  if (Array.isArray(rawRoles)) {
    return rawRoles.map((r) => String(r).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof rawRoles === 'string' && rawRoles.trim()) {
    return rawRoles
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);
  }
  return [UserRole.STUDENT, UserRole.PROFESSOR, UserRole.ADMIN];
}

export function createFacilityDraft(input) {
  const code = String(input.code || '').trim().toUpperCase();
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  const building = String(input.building || 'CICS Building').trim();
  const floor = String(input.floor || '').trim();
  const description = String(input.description || '').trim();
  const rawCapacity = input.capacity;
  const hasCapacity =
    rawCapacity !== null && rawCapacity !== undefined && String(rawCapacity).trim() !== '';
  const capacity = hasCapacity ? Number(rawCapacity) : null;
  const status = String(input.status || FacilityStatus.AVAILABLE).trim();
  const openHour = String(input.openHour || '07:00').trim();
  const closeHour = String(input.closeHour || '21:00').trim();
  const imageUrl = String(input.imageUrl || '').trim();
  const amenitiesList = parseAmenities(input.amenities);
  const allowedRolesList = parseAllowedRoles(input.allowedRoles);
  const isReservable =
    typeof input.isReservable === 'boolean' ? input.isReservable : category === 'Learning';
  const isArchived = Boolean(input.isArchived);

  if (!code || code.length < 2) {
    throw new DomainValidationError('Facility code must be at least 2 characters.');
  }
  if (!name || name.length < 3) {
    throw new DomainValidationError('Facility name must be at least 3 characters.');
  }
  if (!category) {
    throw new DomainValidationError('Facility category is required.');
  }
  if (!building || !floor) {
    throw new DomainValidationError('Building and floor location are required.');
  }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000)) {
    throw new DomainValidationError('Facility capacity must be an integer between 1 and 5000 when specified.');
  }
  if (!Object.values(FacilityStatus).includes(status)) {
    throw new DomainValidationError(`Invalid facility status: ${status}`);
  }
  if (!description || description.length < 10) {
    throw new DomainValidationError('Facility description must be at least 10 characters.');
  }
  if (allowedRolesList.length === 0) {
    throw new DomainValidationError('At least one permitted role must be assigned.');
  }

  return {
    code,
    name,
    category,
    building,
    floor,
    capacity,
    description,
    amenities: JSON.stringify(amenitiesList),
    status,
    allowedRoles: allowedRolesList.join(','),
    openHour,
    closeHour,
    imageUrl: imageUrl || '/assets/images/cics-smart-room.jpg',
    isReservable,
    isArchived,
  };
}

export function createIssueDraft(input) {
  const facilityId = Number(input.facilityId);
  const category = String(input.category || '').trim();
  const priority = String(input.priority || IssuePriority.MEDIUM).trim();
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  const imageDataUrl = input.imageDataUrl ? String(input.imageDataUrl).trim() : null;

  if (!Number.isInteger(facilityId) || facilityId <= 0) {
    throw new DomainValidationError('Please select a valid facility.');
  }
  if (!category) {
    throw new DomainValidationError('Issue category is required.');
  }
  if (!Object.values(IssuePriority).includes(priority)) {
    throw new DomainValidationError('Invalid issue priority.');
  }
  if (!title || title.length < 4 || title.length > 140) {
    throw new DomainValidationError('Issue summary must be between 4 and 140 characters.');
  }
  if (!description || description.length < 10 || description.length > 2000) {
    throw new DomainValidationError('Issue description must be between 10 and 2000 characters.');
  }
  if (imageDataUrl && !imageDataUrl.startsWith('data:image/') && !imageDataUrl.startsWith('/')) {
    throw new DomainValidationError('Supporting image must be a valid image upload.');
  }
  if (imageDataUrl && imageDataUrl.length > 1_500_000) {
    throw new DomainValidationError('Supporting image exceeds maximum upload size (1 MB).');
  }

  return {
    facilityId,
    category,
    priority,
    title,
    description,
    imageDataUrl,
  };
}
