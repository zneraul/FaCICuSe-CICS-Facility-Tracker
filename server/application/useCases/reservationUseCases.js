import {
  ReservationStatus,
  UserRole,
  parseAllowedRoles,
  parseAmenities,
} from '../../domain/entities.js';
import { AuthorizationError, NotFoundError } from '../../domain/errors.js';
import {
  assertCanCancelReservation,
  assertCanRescheduleReservation,
  assertCanReviewReservation,
  assertReservationValid,
  detectScheduleConflicts,
} from '../../domain/rules.js';
import {
  assertNoReservationClassScheduleConflict,
  getManilaTodayIso,
  getManilaWeekday,
  sortClassSchedules,
} from '../../domain/classSchedule.js';
import { formatPublicClassScheduleDto } from './classScheduleUseCases.js';

export function createReservationUseCases({
  facilityRepo,
  reservationRepo,
  classScheduleRepo = null,
  userRepo,
  notificationPort,
  auditLogPort,
}) {
  async function verifyNoRecurringClassConflict({ facility, reservationDate, startTime, endTime }) {
    if (!classScheduleRepo || !facility?.id) return;
    const weekday = getManilaWeekday(reservationDate);
    const sameDayClasses = await classScheduleRepo.listByFacilityAndDay(facility.id, weekday);
    assertNoReservationClassScheduleConflict({
      facility,
      reservationDate,
      startTime,
      endTime,
      classSchedules: sameDayClasses,
    });
  }

  return {
    async createReservationRequest(actor, payload) {
      const facilityId = Number(payload.facilityId);
      const facility = await facilityRepo.findById(facilityId);
      if (!facility) {
        throw new NotFoundError('Selected facility does not exist.');
      }

      const todayIso = getManilaTodayIso();
      const existingForDay = await reservationRepo.listByFacilityAndDate(
        facilityId,
        String(payload.reservationDate || '').trim()
      );

      const validated = assertReservationValid({
        facility,
        existingReservations: existingForDay,
        reservationDate: payload.reservationDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        attendeesCount: payload.attendeesCount,
        purpose: payload.purpose,
        academicBlock: payload.academicBlock ?? null,
        userRole: actor.role,
        todayIso,
      });

      await verifyNoRecurringClassConflict({
        facility,
        reservationDate: validated.slot.date,
        startTime: validated.slot.startTime,
        endTime: validated.slot.endTime,
      });

      const created = await reservationRepo.createWithConflictCheck({
        facilityId: facility.id,
        userId: actor.id,
        reservationDate: validated.slot.date,
        startTime: validated.slot.startTime,
        endTime: validated.slot.endTime,
        purpose: validated.purpose,
        academicBlock: validated.academicBlock,
        attendeesCount: validated.attendeesCount,
        status: ReservationStatus.PENDING,
        isDemo: false,
      });

      await notificationPort.create({
        userId: actor.id,
        title: 'Reservation Request Submitted',
        message: `Your request for ${facility.name} on ${created.reservationDate} (${created.startTime}–${created.endTime}) is Pending review.`,
        type: 'info',
        linkPath: '/app/reservations',
      });

      if (actor.role !== UserRole.ADMIN && userRepo?.listAll) {
        const allUsers = await userRepo.listAll();
        const activeAdmins = allUsers.filter(
          (u) => u.role === UserRole.ADMIN && u.isActive && u.id !== actor.id
        );
        await Promise.all(
          activeAdmins.map((admin) =>
            notificationPort.create({
              userId: admin.id,
              title: 'New Reservation Pending Review',
              message: `${actor.fullName} requested ${facility.name} on ${created.reservationDate} (${created.startTime}–${created.endTime}).`,
              type: 'info',
              linkPath: '/app/admin/reservations',
            })
          )
        );
      }

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RESERVATION_REQUESTED',
        entityType: 'reservation',
        entityId: String(created.id),
        details: `Requested ${facility.code} on ${created.reservationDate} ${created.startTime}-${created.endTime}`,
      });

      return created;
    },

    async getCalendarSchedule(actor, filters = {}) {
      const [allFacilities, allReservations, allClassSchedules] = await Promise.all([
        facilityRepo.listAll(),
        reservationRepo.listAll(),
        classScheduleRepo ? classScheduleRepo.listAll() : Promise.resolve([]),
      ]);

      const formattedFacilities = allFacilities
        .filter((f) => !f.isArchived)
        .map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          category: f.category,
          building: f.building,
          floor: f.floor,
          capacity: f.capacity ?? null,
          status: f.status,
          isReservable: f.isReservable !== false,
          allowedRoles: parseAllowedRoles(f.allowedRoles),
          amenities: parseAmenities(f.amenities),
          openHour: f.openHour,
          closeHour: f.closeHour,
        }));

      const facilityMap = new Map(formattedFacilities.map((f) => [f.id, f]));
      const facilityIdFilter = filters.facilityId && filters.facilityId !== 'All'
        ? Number(filters.facilityId)
        : null;
      const categoryFilter = String(filters.category || '').trim();
      const floorFilter = String(filters.floor || '').trim();
      const statusFilter = String(filters.status || '').trim();
      const startDate = String(filters.startDate || '').trim();
      const endDate = String(filters.endDate || '').trim();
      const weekdayFilter = String(filters.dayOfWeek || '').trim();
      const sectionFilter = String(filters.section || '').trim().toUpperCase();
      const mineOnly = String(filters.mineOnly || '').toLowerCase() === 'true';
      const search = String(filters.search || '').trim().toLowerCase();

      const isAdmin = actor.role === UserRole.ADMIN;
      const allConflicts = isAdmin
        ? detectScheduleConflicts(allReservations, formattedFacilities, allClassSchedules)
        : [];
      const conflictMap = new Map(allConflicts.map((c) => [c.reservationId, c]));

      const events = allReservations
        .filter((r) => {
          const fac = facilityMap.get(r.facilityId);
          if (!fac) return false;
          const isMine = r.userId === actor.id;
          // Non-admins see their own reservations plus active occupied slots (Pending/Confirmed) across CICS Building
          if (!isAdmin && !isMine && r.status !== ReservationStatus.CONFIRMED && r.status !== ReservationStatus.PENDING) {
            return false;
          }
          if (mineOnly && !isMine) return false;
          if (facilityIdFilter && r.facilityId !== facilityIdFilter) return false;
          if (categoryFilter && categoryFilter !== 'All' && fac?.category !== categoryFilter) {
            return false;
          }
          if (floorFilter && floorFilter !== 'All' && floorFilter !== 'All Floors' && fac?.floor !== floorFilter) {
            return false;
          }
          if (statusFilter && statusFilter !== 'All' && r.status !== statusFilter) return false;
          if (startDate && r.reservationDate < startDate) return false;
          if (endDate && r.reservationDate > endDate) return false;
          if (weekdayFilter && weekdayFilter !== 'All') {
            if (getManilaWeekday(r.reservationDate).toLowerCase() !== weekdayFilter.toLowerCase()) {
              return false;
            }
          }
          if (search) {
            const visiblePurpose = isAdmin || isMine ? r.purpose : 'Reserved CICS slot';
            const visibleBlock = isAdmin || isMine ? (r.academicBlock || '') : '';
            const hay = `${r.facilityCode} ${r.facilityName} ${r.facilityBuilding} ${fac.floor} ${visiblePurpose} ${visibleBlock} ${isAdmin || isMine ? r.userFullName : ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .map((r) => {
          const isMine = r.userId === actor.id;
          const fac = facilityMap.get(r.facilityId);
          const conflict = conflictMap.get(r.id) || null;
          return {
            id: r.id,
            facilityId: r.facilityId,
            facilityCode: r.facilityCode,
            facilityName: r.facilityName,
            facilityBuilding: r.facilityBuilding,
            facilityFloor: r.facilityFloor || fac?.floor || '',
            facilityCategory: fac?.category || '',
            facilityStatus: fac?.status || 'Available',
            reservationDate: r.reservationDate,
            startTime: r.startTime,
            endTime: r.endTime,
            status: r.status,
            isMine,
            academicBlock: isAdmin || isMine ? (r.academicBlock || null) : null,
            attendeesCount: isAdmin || isMine ? r.attendeesCount : null,
            purpose: isAdmin || isMine ? r.purpose : 'Reserved CICS time block',
            reviewNote: isAdmin || isMine ? r.reviewNote : null,
            userFullName: isAdmin || isMine ? r.userFullName : 'CICS Member',
            userRole: isAdmin || isMine ? r.userRole : null,
            conflict,
          };
        })
        .sort((a, b) => {
          if (a.reservationDate !== b.reservationDate) {
            return a.reservationDate.localeCompare(b.reservationDate);
          }
          return a.startTime.localeCompare(b.startTime);
        });

      const classSchedules = sortClassSchedules(
        allClassSchedules
          .filter((cs) => {
            if (facilityIdFilter && Number(cs.facilityId) !== facilityIdFilter) return false;
            if (categoryFilter && categoryFilter !== 'All') {
              const fac = cs.facilityId ? facilityMap.get(cs.facilityId) : null;
              if (!fac || fac.category !== categoryFilter) return false;
            }
            if (floorFilter && floorFilter !== 'All' && floorFilter !== 'All Floors') {
              const fac = cs.facilityId ? facilityMap.get(cs.facilityId) : null;
              if (!fac || fac.floor !== floorFilter) return false;
            }
            if (weekdayFilter && weekdayFilter !== 'All') {
              if (cs.dayOfWeek.toLowerCase() !== weekdayFilter.toLowerCase()) return false;
            }
            if (sectionFilter && sectionFilter !== 'ALL') {
              if (String(cs.section || '').toUpperCase() !== sectionFilter) return false;
            }
            if (search) {
              const hay = `${cs.section} ${cs.subjectCode} ${cs.dayOfWeek} ${cs.facilityName || 'Unspecified'} ${cs.facilityCode || ''}`.toLowerCase();
              if (!hay.includes(search)) return false;
            }
            return true;
          })
          .map(formatPublicClassScheduleDto)
      );

      const classSections = Array.from(new Set(allClassSchedules.map((s) => s.section))).sort();

      return {
        events,
        classSchedules,
        classSections,
        facilities: formattedFacilities,
        conflicts: isAdmin ? allConflicts : [],
      };
    },

    async createAdminScheduleBlock(actor, payload) {
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only System Administrators can create official facility schedule blocks.');
      }
      const facilityId = Number(payload.facilityId);
      const facility = await facilityRepo.findById(facilityId);
      if (!facility) {
        throw new NotFoundError('Selected facility does not exist.');
      }

      const todayIso = getManilaTodayIso();
      const existingForDay = await reservationRepo.listByFacilityAndDate(
        facilityId,
        String(payload.reservationDate || '').trim()
      );

      const validated = assertReservationValid({
        facility,
        existingReservations: existingForDay,
        reservationDate: payload.reservationDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        attendeesCount: payload.attendeesCount,
        purpose: payload.purpose,
        academicBlock: payload.academicBlock ?? null,
        userRole: actor.role,
        todayIso,
      });

      await verifyNoRecurringClassConflict({
        facility,
        reservationDate: validated.slot.date,
        startTime: validated.slot.startTime,
        endTime: validated.slot.endTime,
      });

      const targetStatus =
        payload.status === ReservationStatus.PENDING
          ? ReservationStatus.PENDING
          : ReservationStatus.CONFIRMED;

      const created = await reservationRepo.createWithConflictCheck({
        facilityId: facility.id,
        userId: actor.id,
        reservationDate: validated.slot.date,
        startTime: validated.slot.startTime,
        endTime: validated.slot.endTime,
        purpose: validated.purpose,
        academicBlock: validated.academicBlock,
        attendeesCount: validated.attendeesCount,
        status: targetStatus,
        reviewerId: targetStatus === ReservationStatus.CONFIRMED ? actor.id : null,
        reviewNote:
          payload.reviewNote && String(payload.reviewNote).trim()
            ? String(payload.reviewNote).trim()
            : 'Scheduled directly via Calendar Console.',
        isDemo: false,
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SCHEDULE_BLOCK_CREATED',
        entityType: 'reservation',
        entityId: String(created.id),
        details: `Created ${targetStatus} schedule block for ${facility.code} on ${created.reservationDate} ${created.startTime}-${created.endTime}`,
      });

      return created;
    },

    async rescheduleReservation(actor, reservationId, payload) {
      const id = Number(reservationId);
      const reservation = await reservationRepo.findById(id);
      if (!reservation) {
        throw new NotFoundError('Reservation not found.');
      }
      assertCanRescheduleReservation(actor.role, reservation);

      const targetFacilityId = payload.facilityId ? Number(payload.facilityId) : reservation.facilityId;
      const facility = await facilityRepo.findById(targetFacilityId);
      if (!facility) {
        throw new NotFoundError('Target facility does not exist.');
      }

      const targetDate = String(payload.reservationDate || reservation.reservationDate).trim();
      const targetStart = String(payload.startTime || reservation.startTime).trim();
      const targetEnd = String(payload.endTime || reservation.endTime).trim();
      const sameDay = await reservationRepo.listByFacilityAndDate(targetFacilityId, targetDate);
      const requester = await userRepo.findById(reservation.userId);

      const validated = assertReservationValid({
        facility,
        existingReservations: sameDay,
        reservationDate: targetDate,
        startTime: targetStart,
        endTime: targetEnd,
        attendeesCount: reservation.attendeesCount,
        purpose: reservation.purpose,
        userRole: requester ? requester.role : actor.role,
        ignoreReservationId: reservation.id,
      });

      await verifyNoRecurringClassConflict({
        facility,
        reservationDate: validated.slot.date,
        startTime: validated.slot.startTime,
        endTime: validated.slot.endTime,
      });

      const updated = await reservationRepo.rescheduleWithConflictCheck(id, {
        facilityId: facility.id,
        reservationDate: validated.slot.date,
        startTime: validated.slot.startTime,
        endTime: validated.slot.endTime,
        reviewerId: actor.id,
        reviewNote:
          payload.reviewNote && String(payload.reviewNote).trim()
            ? String(payload.reviewNote).trim()
            : `Rescheduled by administrator to ${validated.slot.date} ${validated.slot.startTime}–${validated.slot.endTime}.`,
      });

      await notificationPort.create({
        userId: reservation.userId,
        title: 'Reservation Rescheduled',
        message: `Booking #${id} moved to ${facility.name} on ${validated.slot.date} (${validated.slot.startTime}–${validated.slot.endTime}).`,
        type: 'info',
        linkPath: '/app/calendar',
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RESERVATION_RESCHEDULED',
        entityType: 'reservation',
        entityId: String(id),
        details: `Rescheduled #${id} to ${facility.code} ${validated.slot.date} ${validated.slot.startTime}-${validated.slot.endTime}`,
      });

      return updated;
    },

    async listUserReservations(actor, statusFilter = 'All') {
      const rows = await reservationRepo.listByUserId(actor.id);
      if (!statusFilter || statusFilter === 'All') {
        return rows;
      }
      return rows.filter((row) => row.status === statusFilter);
    },

    async cancelUserReservation(actor, reservationId) {
      const id = Number(reservationId);
      const reservation = await reservationRepo.findById(id);
      if (!reservation) {
        throw new NotFoundError('Reservation not found.');
      }
      assertCanCancelReservation(actor, reservation);

      const updated = await reservationRepo.updateStatus(id, {
        status: ReservationStatus.CANCELLED,
        reviewNote:
          actor.id === reservation.userId
            ? 'Cancelled by requester.'
            : 'Cancelled by System Administrator.',
      });

      await notificationPort.create({
        userId: reservation.userId,
        title: 'Reservation Cancelled',
        message: `Reservation #${id} for ${reservation.reservationDate} (${reservation.startTime}–${reservation.endTime}) has been cancelled.`,
        type: 'warning',
        linkPath: '/app/reservations',
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'RESERVATION_CANCELLED',
        entityType: 'reservation',
        entityId: String(id),
        details: `Cancelled reservation #${id}`,
      });

      return updated;
    },

    async listAllReservationsForAdmin(actor, statusFilter = 'All') {
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only System Administrators may view all campus reservations.');
      }
      const rows = await reservationRepo.listAll();
      if (!statusFilter || statusFilter === 'All') {
        return rows;
      }
      return rows.filter((row) => row.status === statusFilter);
    },

    async reviewReservation(actor, reservationId, { status, reviewNote }) {
      const id = Number(reservationId);
      const reservation = await reservationRepo.findById(id);
      if (!reservation) {
        throw new NotFoundError('Reservation not found.');
      }

      assertCanReviewReservation(actor.role, reservation, status);

      // Re-verify conflict invariant before confirming (both dated bookings and recurring classes)
      if (status === ReservationStatus.CONFIRMED) {
        const facility = await facilityRepo.findById(reservation.facilityId);
        const sameDay = await reservationRepo.listByFacilityAndDate(
          reservation.facilityId,
          reservation.reservationDate
        );
        const requester = await userRepo.findById(reservation.userId);
        assertReservationValid({
          facility,
          existingReservations: sameDay,
          reservationDate: reservation.reservationDate,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          attendeesCount: reservation.attendeesCount,
          purpose: reservation.purpose,
          userRole: requester ? requester.role : actor.role,
          ignoreReservationId: reservation.id,
        });

        await verifyNoRecurringClassConflict({
          facility,
          reservationDate: reservation.reservationDate,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
        });
      }

      const updated = await reservationRepo.updateStatus(id, {
        status,
        reviewerId: actor.id,
        reviewNote: reviewNote ? String(reviewNote).trim() : null,
      });

      await notificationPort.create({
        userId: reservation.userId,
        title: `Reservation ${status}`,
        message: `Your reservation #${id} on ${reservation.reservationDate} (${reservation.startTime}–${reservation.endTime}) was marked ${status}.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
        type: status === ReservationStatus.CONFIRMED ? 'success' : 'warning',
        linkPath: '/app/reservations',
      });

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: `RESERVATION_${status.toUpperCase()}`,
        entityType: 'reservation',
        entityId: String(id),
        details: `Set reservation #${id} to ${status}`,
      });

      return updated;
    },
  };
}

