import { UserRole } from '../../domain/entities.js';
import { AuthorizationError, DomainValidationError, NotFoundError } from '../../domain/errors.js';
import {
  ALL_CLASS_WEEKDAYS,
  ALLOWED_CLASS_WEEKDAYS,
  CLASS_SCHEDULE_OPERATING_HOURS,
  ClassScheduleSource,
  ClassScheduleVerificationStatus,
  NON_INSTRUCTIONAL_WEEKDAYS,
  formatVerificationStatusLabel,
  getManilaTodayIso,
  getManilaWeekday,
  isEligibleClassScheduleFacility,
  normalizeVerificationStatus,
  sortClassSchedules,
  validateClassScheduleDraft,
} from '../../domain/classSchedule.js';

/**
 * Public / non-admin sanitized DTO for recurring class schedules.
 * Exposes ZERO private user/administrator IDs, emails, names, or audit metadata.
 */
export function formatPublicClassScheduleDto(row) {
  return {
    id: row.id,
    section: row.section,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    subjectCode: row.subjectCode,
    facilityId: row.facilityId ?? null,
    facilityCode: row.facilityCode || null,
    facilityName: row.facilityId ? row.facilityName || 'Unspecified' : 'Unspecified',
    facilityBuilding: row.facilityBuilding || null,
    facilityFloor: row.facilityFloor || null,
    facilityCategory: row.facilityCategory || null,
    verificationStatus: row.verificationStatus,
    verificationLabel: formatVerificationStatusLabel(row.verificationStatus),
  };
}

/**
 * Administrator DTO includes provenance and verification audit metadata.
 */
function formatAdminClassScheduleDto(row) {
  return {
    ...formatPublicClassScheduleDto(row),
    source: row.source,
    verifiedBy: row.verifiedBy ?? null,
    verifiedByName: row.verifiedByName || null,
    verifiedAt: row.verifiedAt || null,
    createdBy: row.createdBy ?? null,
    createdByName: row.createdByName || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function applyClassScheduleFilters(schedules, filters = {}) {
  const dayFilter = String(filters.dayOfWeek || '').trim();
  const sectionFilter = String(filters.section || '').trim().toUpperCase();
  const facilityIdFilter =
    filters.facilityId !== undefined &&
    filters.facilityId !== null &&
    String(filters.facilityId).trim() !== '' &&
    String(filters.facilityId).trim() !== 'All'
      ? String(filters.facilityId).trim()
      : null;
  const verificationFilter = String(filters.verificationStatus || '').trim().toUpperCase();
  const search = String(filters.search || '').trim().toLowerCase();

  return sortClassSchedules(
    schedules.filter((item) => {
      if (dayFilter && dayFilter !== 'All' && item.dayOfWeek.toLowerCase() !== dayFilter.toLowerCase()) {
        return false;
      }
      if (sectionFilter && sectionFilter !== 'ALL' && item.section.toUpperCase() !== sectionFilter) {
        return false;
      }
      if (facilityIdFilter) {
        if (facilityIdFilter.toUpperCase() === 'UNSPECIFIED') {
          if (item.facilityId !== null) return false;
        } else if (Number(item.facilityId) !== Number(facilityIdFilter)) {
          return false;
        }
      }
      if (
        verificationFilter &&
        verificationFilter !== 'ALL' &&
        String(item.verificationStatus || '').toUpperCase() !== verificationFilter
      ) {
        return false;
      }
      if (search) {
        const hay = [
          item.section,
          item.subjectCode,
          item.dayOfWeek,
          item.startTime,
          item.endTime,
          item.facilityName || 'Unspecified',
          item.facilityCode || '',
          formatVerificationStatusLabel(item.verificationStatus),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    })
  );
}

export function createClassScheduleUseCases({
  classScheduleRepo,
  facilityRepo,
  auditLogPort,
}) {
  function assertAdmin(actor) {
    if (!actor || actor.role !== UserRole.ADMIN) {
      throw new AuthorizationError(
        'Only System Administrators may manage recurring class schedules.'
      );
    }
  }

  return {
    async listPublicClassSchedules(filters = {}) {
      const all = await classScheduleRepo.listAll();
      const filtered = applyClassScheduleFilters(all, filters);
      const sections = Array.from(new Set(all.map((s) => s.section))).sort();
      return {
        schedules: filtered.map(formatPublicClassScheduleDto),
        sections,
        allowedWeekdays: [...ALLOWED_CLASS_WEEKDAYS],
        allWeekdays: [...ALL_CLASS_WEEKDAYS],
        nonInstructionalWeekdays: [...NON_INSTRUCTIONAL_WEEKDAYS],
        operatingHours: { ...CLASS_SCHEDULE_OPERATING_HOURS },
      };
    },

    async getTodaysClassSchedules(dateOverride = null) {
      const manilaDate = dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(String(dateOverride).trim())
        ? String(dateOverride).trim()
        : getManilaTodayIso();
      const weekday = getManilaWeekday(manilaDate);
      const isNonInstructionalDay = NON_INSTRUCTIONAL_WEEKDAYS.includes(weekday) || weekday === 'Sunday';
      const rows = isNonInstructionalDay
        ? []
        : await classScheduleRepo.listByDayOfWeek(weekday);

      return {
        weekday,
        manilaDate,
        isNonInstructionalDay,
        nonInstructionalWeekdays: [...NON_INSTRUCTIONAL_WEEKDAYS],
        schedules: sortClassSchedules(rows).map(formatPublicClassScheduleDto),
      };
    },

    async listAdminClassSchedules(actor, filters = {}) {
      assertAdmin(actor);
      const [allSchedules, allFacilities] = await Promise.all([
        classScheduleRepo.listAll(),
        facilityRepo.listAll(),
      ]);

      const eligibleFacilities = allFacilities
        .filter(isEligibleClassScheduleFacility)
        .map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          floor: f.floor,
          building: f.building,
          category: f.category,
          capacity: f.capacity ?? null,
          status: f.status,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const filtered = applyClassScheduleFilters(allSchedules, filters);
      const sections = Array.from(new Set(allSchedules.map((s) => s.section))).sort();

      return {
        schedules: filtered.map(formatAdminClassScheduleDto),
        totalCount: allSchedules.length,
        sections,
        eligibleFacilities,
        allWeekdays: [...ALL_CLASS_WEEKDAYS],
        allowedWeekdays: [...ALLOWED_CLASS_WEEKDAYS],
        nonInstructionalWeekdays: [...NON_INSTRUCTIONAL_WEEKDAYS],
        operatingHours: { ...CLASS_SCHEDULE_OPERATING_HOURS },
      };
    },

    async createClassSchedule(actor, payload = {}) {
      assertAdmin(actor);

      let facility = null;
      const rawFacilityId = payload.facilityId;
      const isUnspecified =
        rawFacilityId === null ||
        rawFacilityId === undefined ||
        String(rawFacilityId).trim() === '' ||
        String(rawFacilityId).trim().toUpperCase() === 'UNSPECIFIED';

      if (!isUnspecified) {
        const parsedId = Number(rawFacilityId);
        if (Number.isInteger(parsedId) && parsedId > 0) {
          facility = await facilityRepo.findById(parsedId);
        }
      }

      const requestedStatus = payload.verificationStatus
        ? normalizeVerificationStatus(payload.verificationStatus)
        : ClassScheduleVerificationStatus.SUPPLIED_UNVERIFIED;

      if (
        requestedStatus === ClassScheduleVerificationStatus.ADMIN_VERIFIED &&
        payload.confirmVerified !== true
      ) {
        throw new DomainValidationError(
          'Explicit administrator confirmation is required before marking a schedule as Admin Verified.'
        );
      }

      const validated = validateClassScheduleDraft(
        {
          ...payload,
          source: ClassScheduleSource.ADMIN_MANUAL,
          verificationStatus: requestedStatus,
          confirmVerified: payload.confirmVerified === true,
        },
        { facility }
      );

      const nowIso = new Date().toISOString();
      const isVerified =
        validated.verificationStatus === ClassScheduleVerificationStatus.ADMIN_VERIFIED;

      const created = await classScheduleRepo.createWithConflictCheck({
        ...validated,
        createdBy: actor.id,
        verifiedBy: isVerified ? actor.id : null,
        verifiedAt: isVerified ? nowIso : null,
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CLASS_SCHEDULE_CREATED',
        entityType: 'class_schedule',
        entityId: String(created.id),
        details: `Created recurring class ${created.section} ${created.subjectCode} (${created.dayOfWeek} ${created.startTime}-${created.endTime}, ${created.facilityName || 'Unspecified'}, ${created.verificationStatus})`,
      });

      return formatAdminClassScheduleDto(created);
    },

    async updateClassSchedule(actor, scheduleId, payload = {}) {
      assertAdmin(actor);
      const id = Number(scheduleId);
      const existing = await classScheduleRepo.findById(id);
      if (!existing) {
        throw new NotFoundError('Recurring class schedule not found.');
      }

      const mergedFacilityId =
        payload.facilityId !== undefined ? payload.facilityId : existing.facilityId;
      let facility = null;
      const isUnspecified =
        mergedFacilityId === null ||
        mergedFacilityId === undefined ||
        String(mergedFacilityId).trim() === '' ||
        String(mergedFacilityId).trim().toUpperCase() === 'UNSPECIFIED';

      if (!isUnspecified) {
        const parsedId = Number(mergedFacilityId);
        if (Number.isInteger(parsedId) && parsedId > 0) {
          facility = await facilityRepo.findById(parsedId);
        }
      }

      const validated = validateClassScheduleDraft(
        {
          section: payload.section !== undefined ? payload.section : existing.section,
          dayOfWeek: payload.dayOfWeek !== undefined ? payload.dayOfWeek : existing.dayOfWeek,
          startTime: payload.startTime !== undefined ? payload.startTime : existing.startTime,
          endTime: payload.endTime !== undefined ? payload.endTime : existing.endTime,
          subjectCode: payload.subjectCode !== undefined ? payload.subjectCode : existing.subjectCode,
          facilityId: mergedFacilityId,
          modality: payload.modality,
          deliveryMode: payload.deliveryMode,
          scheduleType: payload.scheduleType,
          facilityName: payload.facilityName,
          roomLabel: payload.roomLabel,
          notes: payload.notes,
          source: existing.source,
        },
        { facility }
      );

      let nextVerificationStatus = existing.verificationStatus;
      let nextVerifiedBy = existing.verifiedBy ?? null;
      let nextVerifiedAt = existing.verifiedAt || null;

      if (payload.verificationStatus !== undefined) {
        const requested = normalizeVerificationStatus(payload.verificationStatus);
        if (
          requested === ClassScheduleVerificationStatus.ADMIN_VERIFIED &&
          existing.verificationStatus !== ClassScheduleVerificationStatus.ADMIN_VERIFIED &&
          payload.confirmVerified !== true
        ) {
          throw new DomainValidationError(
            'Explicit administrator confirmation is required before marking a schedule as Admin Verified.'
          );
        }
        nextVerificationStatus = requested;
        if (requested === ClassScheduleVerificationStatus.ADMIN_VERIFIED) {
          nextVerifiedBy = existing.verifiedBy || actor.id;
          nextVerifiedAt = existing.verifiedAt || new Date().toISOString();
        } else {
          nextVerifiedBy = null;
          nextVerifiedAt = null;
        }
      }

      const updated = await classScheduleRepo.updateWithConflictCheck(id, {
        ...validated,
        verificationStatus: nextVerificationStatus,
        verifiedBy: nextVerifiedBy,
        verifiedAt: nextVerifiedAt,
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CLASS_SCHEDULE_UPDATED',
        entityType: 'class_schedule',
        entityId: String(id),
        details: `Updated recurring class #${id}: ${updated.section} ${updated.subjectCode} (${updated.dayOfWeek} ${updated.startTime}-${updated.endTime}, ${updated.facilityName || 'Unspecified'}, ${updated.verificationStatus})`,
      });

      return formatAdminClassScheduleDto(updated);
    },

    async verifyClassSchedule(actor, scheduleId, payload = {}) {
      assertAdmin(actor);
      const id = Number(scheduleId);
      const existing = await classScheduleRepo.findById(id);
      if (!existing) {
        throw new NotFoundError('Recurring class schedule not found.');
      }

      const nextStatus = normalizeVerificationStatus(
        payload.verificationStatus || ClassScheduleVerificationStatus.ADMIN_VERIFIED
      );

      if (
        nextStatus === ClassScheduleVerificationStatus.ADMIN_VERIFIED &&
        payload.confirmVerified === false
      ) {
        throw new DomainValidationError(
          'Explicit administrator confirmation is required before marking a schedule as Admin Verified.'
        );
      }

      const isVerified = nextStatus === ClassScheduleVerificationStatus.ADMIN_VERIFIED;
      const updated = await classScheduleRepo.updateVerificationStatus(id, {
        verificationStatus: nextStatus,
        verifiedBy: isVerified ? actor.id : null,
        verifiedAt: isVerified ? new Date().toISOString() : null,
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CLASS_SCHEDULE_VERIFICATION_CHANGED',
        entityType: 'class_schedule',
        entityId: String(id),
        details: `Changed verification for ${updated.section} ${updated.subjectCode} (${updated.dayOfWeek} ${updated.startTime}-${updated.endTime}) from ${existing.verificationStatus} to ${updated.verificationStatus}`,
      });

      return formatAdminClassScheduleDto(updated);
    },

    async deleteClassSchedule(actor, scheduleId) {
      assertAdmin(actor);
      const id = Number(scheduleId);
      const existing = await classScheduleRepo.findById(id);
      if (!existing) {
        throw new NotFoundError('Recurring class schedule not found.');
      }

      await classScheduleRepo.remove(id);

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CLASS_SCHEDULE_DELETED',
        entityType: 'class_schedule',
        entityId: String(id),
        details: `Deleted recurring class #${id}: ${existing.section} ${existing.subjectCode} (${existing.dayOfWeek} ${existing.startTime}-${existing.endTime})`,
      });

      return { deleted: true, id };
    },
  };
}
