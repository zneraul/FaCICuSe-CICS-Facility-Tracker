import {
  FacilityStatus,
  UserRole,
  createFacilityDraft,
  parseAllowedRoles,
  parseAmenities,
} from '../../domain/entities.js';
import { AuthorizationError, ConflictError, NotFoundError } from '../../domain/errors.js';
import {
  getManilaTodayIso,
  getManilaWeekday,
  sortClassSchedules,
} from '../../domain/classSchedule.js';
import { formatPublicClassScheduleDto } from './classScheduleUseCases.js';
import { resolveFacilityImageUrl } from '../../domain/facilityMedia.js';

function formatFacilityDto(facility) {
  return {
    id: facility.id,
    code: facility.code,
    name: facility.name,
    category: facility.category,
    building: facility.building,
    floor: facility.floor,
    capacity: facility.capacity ?? null,
    description: facility.description,
    amenities: parseAmenities(facility.amenities),
    status: facility.status,
    allowedRoles: parseAllowedRoles(facility.allowedRoles),
    openHour: facility.openHour,
    closeHour: facility.closeHour,
    imageUrl: resolveFacilityImageUrl(facility),
    isReservable: facility.isReservable !== false,
    isArchived: Boolean(facility.isArchived),
    createdAt: facility.createdAt,
  };
}

export function createFacilityUseCases({
  facilityRepo,
  reservationRepo,
  classScheduleRepo = null,
  issueRepo,
  auditLogPort,
}) {
  function applyFilters(facilities, query = {}) {
    const search = String(query.search || '').trim().toLowerCase();
    const category = String(query.category || '').trim();
    const floor = String(query.floor || '').trim();
    const status = String(query.status || '').trim();
    const minCapacity = Number(query.minCapacity || 0);
    const reservableOnly = String(query.reservableOnly || '').toLowerCase() === 'true';

    return facilities
      .filter((item) => !item.isArchived)
      .map(formatFacilityDto)
      .filter((item) => {
        if (category && category !== 'All' && item.category !== category) {
          return false;
        }
        if (floor && floor !== 'All' && floor !== 'All Floors' && item.floor !== floor) {
          return false;
        }
        if (status && status !== 'All' && item.status !== status) {
          return false;
        }
        if (reservableOnly && !item.isReservable) {
          return false;
        }
        if (minCapacity > 0 && (item.capacity === null || item.capacity < minCapacity)) {
          return false;
        }
        if (search) {
          const haystack = [
            item.name,
            item.code,
            item.building,
            item.floor,
            item.category,
            item.description,
            ...item.amenities,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      });
  }

  return {
    async listPublicFacilities(query) {
      const all = await facilityRepo.listAll();
      return applyFilters(all, query);
    },

    async getPublicFacilityDetail(facilityId, date) {
      const id = Number(facilityId);
      const facility = await facilityRepo.findById(id);
      if (!facility || facility.isArchived) {
        throw new NotFoundError('Facility not found.');
      }
      const targetDate = date || getManilaTodayIso();
      const weekday = getManilaWeekday(targetDate);
      const [dayReservations, recurringClasses] = await Promise.all([
        reservationRepo.listByFacilityAndDate(id, targetDate),
        classScheduleRepo
          ? classScheduleRepo.listByFacilityAndDay(id, weekday)
          : Promise.resolve([]),
      ]);

      // Expose only anonymized schedule windows publicly (no user PII)
      const publicSchedule = dayReservations
        .filter((r) => r.status === 'Confirmed' || r.status === 'Pending')
        .map((r) => ({
          id: r.id,
          reservationDate: r.reservationDate,
          startTime: r.startTime,
          endTime: r.endTime,
          status: r.status,
        }));

      return {
        facility: formatFacilityDto(facility),
        scheduleDate: targetDate,
        scheduleWeekday: weekday,
        schedule: publicSchedule,
        classSchedules: sortClassSchedules(recurringClasses).map(formatPublicClassScheduleDto),
      };
    },

    async listFacilitiesForUser(actor, query) {
      const all = await facilityRepo.listAll();
      return applyFilters(all, query);
    },

    async getFacilityDetailForUser(actor, facilityId, date) {
      const id = Number(facilityId);
      const facility = await facilityRepo.findById(id);
      if (!facility || facility.isArchived) {
        throw new NotFoundError('Facility not found.');
      }
      const targetDate = date || getManilaTodayIso();
      const weekday = getManilaWeekday(targetDate);
      const [dayReservations, allIssues, recurringClasses] = await Promise.all([
        reservationRepo.listByFacilityAndDate(id, targetDate),
        issueRepo.listAll(),
        classScheduleRepo
          ? classScheduleRepo.listByFacilityAndDay(id, weekday)
          : Promise.resolve([]),
      ]);
      const facilityIssues = allIssues
        .filter((issue) => issue.facilityId === id && issue.status !== 'Closed')
        .slice(0, 5);

      const schedule = dayReservations
        .filter((r) => r.status === 'Confirmed' || r.status === 'Pending')
        .map((r) => ({
          id: r.id,
          reservationDate: r.reservationDate,
          startTime: r.startTime,
          endTime: r.endTime,
          status: r.status,
          purpose: actor.role === UserRole.ADMIN || r.userId === actor.id ? r.purpose : 'Reserved academic/campus block',
        }));

      return {
        facility: formatFacilityDto(facility),
        scheduleDate: targetDate,
        scheduleWeekday: weekday,
        schedule,
        classSchedules: sortClassSchedules(recurringClasses).map(formatPublicClassScheduleDto),
        activeIssues: facilityIssues,
      };
    },

    async createFacility(actor, payload) {
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only System Administrators can create facilities.');
      }
      const draft = createFacilityDraft(payload);
      const existingCode = await facilityRepo.findByCode(draft.code);
      if (existingCode) {
        throw new ConflictError(`A facility with code "${draft.code}" already exists.`);
      }
      const created = await facilityRepo.create({ ...draft, isDemo: false });
      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FACILITY_CREATED',
        entityType: 'facility',
        entityId: String(created.id),
        details: `Created facility ${created.code} (${created.name})`,
      });
      return formatFacilityDto(created);
    },

    async updateFacility(actor, facilityId, payload) {
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only System Administrators can update facilities.');
      }
      const id = Number(facilityId);
      const existing = await facilityRepo.findById(id);
      if (!existing) {
        throw new NotFoundError('Facility not found.');
      }
      const draft = createFacilityDraft({ ...existing, ...payload });
      if (draft.code !== existing.code) {
        const duplicate = await facilityRepo.findByCode(draft.code);
        if (duplicate && duplicate.id !== id) {
          throw new ConflictError(`Facility code "${draft.code}" is already in use.`);
        }
      }
      const updated = await facilityRepo.update(id, draft);
      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FACILITY_UPDATED',
        entityType: 'facility',
        entityId: String(id),
        details: `Updated ${updated.code} (${updated.status})`,
      });
      return formatFacilityDto(updated);
    },

    async deleteFacility(actor, facilityId) {
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only System Administrators can delete facilities.');
      }
      const id = Number(facilityId);
      const existing = await facilityRepo.findById(id);
      if (!existing) {
        throw new NotFoundError('Facility not found.');
      }
      await facilityRepo.remove(id);
      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'FACILITY_DELETED',
        entityType: 'facility',
        entityId: String(id),
        details: `Deleted facility ${existing.code} (${existing.name})`,
      });
      return { deleted: true, id };
    },
  };
}
