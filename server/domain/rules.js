import {
  ACTIVE_BLOCKING_STATUSES,
  ALL_USER_ROLES,
  FacilityStatus,
  IssueStatus,
  ReservationStatus,
  UserRole,
  parseAllowedRoles,
} from './entities.js';
import {
  AuthorizationError,
  ConflictError,
  DomainValidationError,
} from './errors.js';
import { TimeSlot, normalizeAcademicBlock, toMinutes } from './valueObjects.js';
import {
  findReservationClassScheduleConflict,
  formatVerificationStatusLabel,
} from './classSchedule.js';

export function assertCanAccessFacility(userRole, facility) {
  if (!facility) {
    throw new DomainValidationError('Facility does not exist.');
  }
  if (facility.isArchived) {
    throw new ConflictError(`Facility "${facility.name}" is archived and no longer part of active inventory.`);
  }
  const role = String(userRole || '').toLowerCase();
  if (role === UserRole.ADMIN) return;
  const allowed = parseAllowedRoles(facility.allowedRoles);
  if (!allowed.includes(role)) {
    throw new AuthorizationError(
      `Your role (${role}) does not have permission to reserve "${facility.name}".`
    );
  }
}

export function assertReservationValid({
  facility,
  existingReservations,
  reservationDate,
  startTime,
  endTime,
  attendeesCount,
  purpose,
  academicBlock = null,
  userRole,
  todayIso,
  ignoreReservationId = null,
}) {
  assertCanAccessFacility(userRole, facility);

  if (facility.isReservable === false) {
    throw new ConflictError(
      `"${facility.name}" (${facility.category}) is not a reservable facility.`
    );
  }

  if (facility.status !== FacilityStatus.AVAILABLE) {
    throw new ConflictError(
      `Facility "${facility.name}" is currently marked as ${facility.status} and cannot accept reservations.`
    );
  }

  const slot = new TimeSlot(reservationDate, startTime, endTime);

  if (todayIso && slot.date < todayIso) {
    throw new DomainValidationError('Reservations cannot be requested for a past date.');
  }

  if (!slot.isWithinOperatingHours(facility.openHour, facility.closeHour)) {
    throw new DomainValidationError(
      `Requested hours (${slot.startTime}–${slot.endTime}) fall outside "${facility.name}" operating hours (${facility.openHour}–${facility.closeHour}).`
    );
  }

  const attendees = Number(attendeesCount);
  if (!Number.isInteger(attendees) || attendees < 1) {
    throw new DomainValidationError('Expected attendee count must be at least 1.');
  }
  if (
    facility.capacity !== null &&
    facility.capacity !== undefined &&
    Number(facility.capacity) > 0 &&
    attendees > Number(facility.capacity)
  ) {
    throw new DomainValidationError(
      `Attendee count (${attendees}) exceeds facility capacity (${facility.capacity}).`
    );
  }

  const cleanPurpose = String(purpose || '').trim();
  if (cleanPurpose.length < 5 || cleanPurpose.length > 300) {
    throw new DomainValidationError('Reservation purpose must be between 5 and 300 characters.');
  }

  const normalizedBlock = normalizeAcademicBlock(academicBlock);

  const conflicting = (existingReservations || []).find((existing) => {
    if (ignoreReservationId && existing.id === ignoreReservationId) return false;
    if (!ACTIVE_BLOCKING_STATUSES.includes(existing.status)) return false;
    const existingSlot = new TimeSlot(
      existing.reservationDate,
      existing.startTime,
      existing.endTime
    );
    return slot.overlapsWith(existingSlot);
  });

  if (conflicting) {
    throw new ConflictError(
      `Time conflict with an existing ${conflicting.status.toLowerCase()} booking (${conflicting.startTime}–${conflicting.endTime}) on ${conflicting.reservationDate}.`
    );
  }

  return {
    slot,
    attendeesCount: attendees,
    purpose: cleanPurpose,
    academicBlock: normalizedBlock,
  };
}

export function assertCanCancelReservation(actorUser, reservation) {
  if (!actorUser || !reservation) {
    throw new DomainValidationError('Missing user or reservation context.');
  }
  const isOwner = reservation.userId === actorUser.id;
  const isAdmin = actorUser.role === UserRole.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AuthorizationError('You can only cancel your own reservations.');
  }
  if (
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.REJECTED ||
    reservation.status === ReservationStatus.COMPLETED
  ) {
    throw new ConflictError(
      `Cannot cancel a reservation that is already ${reservation.status.toLowerCase()}.`
    );
  }
}

export function assertCanReviewReservation(actorRole, reservation, nextStatus) {
  if (actorRole !== UserRole.ADMIN) {
    throw new AuthorizationError('Only System Administrators may approve or reject reservations.');
  }
  if (![ReservationStatus.CONFIRMED, ReservationStatus.REJECTED, ReservationStatus.COMPLETED].includes(nextStatus)) {
    throw new DomainValidationError(`Invalid administrative reservation status: ${nextStatus}`);
  }
  if (reservation.status === ReservationStatus.CANCELLED) {
    throw new ConflictError('Cannot modify a reservation that was cancelled by the requester.');
  }
}

export function assertCanRescheduleReservation(actorRole, reservation) {
  if (actorRole !== UserRole.ADMIN) {
    throw new AuthorizationError('Only System Administrators may reschedule reservations.');
  }
  if (!reservation) {
    throw new DomainValidationError('Reservation not found.');
  }
  if (
    reservation.status === ReservationStatus.CANCELLED ||
    reservation.status === ReservationStatus.REJECTED ||
    reservation.status === ReservationStatus.COMPLETED
  ) {
    throw new ConflictError(
      `Cannot reschedule a reservation that is already ${reservation.status.toLowerCase()}.`
    );
  }
}

export function detectScheduleConflicts(reservations, facilities, classSchedules = []) {
  const safeReservations = Array.isArray(reservations) ? reservations : [];
  const safeFacilities = (Array.isArray(facilities) ? facilities : []).filter((f) => !f.isArchived);
  const safeClassSchedules = Array.isArray(classSchedules) ? classSchedules : [];
  const facilityMap = new Map(safeFacilities.map((f) => [f.id, f]));

  const active = safeReservations.filter(
    (r) => ACTIVE_BLOCKING_STATUSES.includes(r.status) && facilityMap.has(r.facilityId)
  );
  const conflicts = [];

  for (let i = 0; i < active.length; i += 1) {
    const item = active[i];
    const facility = facilityMap.get(item.facilityId);
    const reasons = [];

    if (facility && facility.isReservable === false) {
      reasons.push(`Facility (${facility.category}) is not reservable`);
    }

    if (facility && facility.status !== FacilityStatus.AVAILABLE) {
      reasons.push(`Facility status is ${facility.status}`);
    }

    if (facility) {
      try {
        const slot = new TimeSlot(item.reservationDate, item.startTime, item.endTime);
        if (!slot.isWithinOperatingHours(facility.openHour, facility.closeHour)) {
          reasons.push(`Outside facility hours (${facility.openHour}–${facility.closeHour})`);
        }
      } catch {
        reasons.push('Invalid schedule time range');
      }
    }

    for (let j = 0; j < active.length; j += 1) {
      if (i === j) continue;
      const other = active[j];
      if (other.facilityId !== item.facilityId || other.reservationDate !== item.reservationDate) {
        continue;
      }
      try {
        const slotA = new TimeSlot(item.reservationDate, item.startTime, item.endTime);
        const slotB = new TimeSlot(other.reservationDate, other.startTime, other.endTime);
        if (slotA.overlapsWith(slotB)) {
          reasons.push(`Overlaps booking #${other.id} (${other.startTime}–${other.endTime})`);
        }
      } catch {
        // ignore invalid legacy times
      }
    }

    if (safeClassSchedules.length > 0) {
      try {
        const classConflict = findReservationClassScheduleConflict({
          facilityId: item.facilityId,
          reservationDate: item.reservationDate,
          startTime: item.startTime,
          endTime: item.endTime,
          classSchedules: safeClassSchedules,
        });
        if (classConflict) {
          reasons.push(
            `Overlaps recurring class ${classConflict.subjectCode} (${classConflict.section}, ${classConflict.dayOfWeek} ${classConflict.startTime}–${classConflict.endTime}, ${formatVerificationStatusLabel(classConflict.verificationStatus)})`
          );
        }
      } catch {
        // ignore invalid legacy dates
      }
    }

    if (reasons.length > 0) {
      conflicts.push({
        reservationId: item.id,
        facilityId: item.facilityId,
        facilityName: facility?.name || item.facilityName || 'Unknown Facility',
        facilityCode: facility?.code || item.facilityCode || '',
        reservationDate: item.reservationDate,
        startTime: item.startTime,
        endTime: item.endTime,
        status: item.status,
        reasons,
      });
    }
  }

  return conflicts;
}

export function assertCanUpdateIssue(actorRole, nextStatus) {
  if (actorRole !== UserRole.ADMIN) {
    throw new AuthorizationError('Only System Administrators may update maintenance issue status.');
  }
  if (!Object.values(IssueStatus).includes(nextStatus)) {
    throw new DomainValidationError(`Invalid maintenance status: ${nextStatus}`);
  }
}

export function assertCanManageUsers(actorRole, _targetUser, nextRole) {
  if (actorRole !== UserRole.ADMIN) {
    throw new AuthorizationError('Only System Administrators may manage user accounts.');
  }
  if (nextRole && !ALL_USER_ROLES.includes(nextRole)) {
    throw new DomainValidationError(`Invalid role "${nextRole}".`);
  }
}

export function assertCanAccessAnalytics(actorRole) {
  if (actorRole !== UserRole.ADMIN) {
    throw new AuthorizationError(
      'Administrative analytics are strictly restricted to System Administrators.'
    );
  }
}

export function computeDashboardMetrics({ reservations, issues, facilities, user, todayIso }) {
  const safeFacilities = (Array.isArray(facilities) ? facilities : []).filter(
    (f) => !f.isArchived && !f.isDemo
  );
  const activeFacilityIds = new Set(safeFacilities.map((f) => f.id));
  const safeReservations = (Array.isArray(reservations) ? reservations : []).filter(
    (r) => !r.isDemo && (activeFacilityIds.size === 0 ? true : activeFacilityIds.has(r.facilityId))
  );
  const safeIssues = (Array.isArray(issues) ? issues : []).filter(
    (i) => !i.isDemo && (activeFacilityIds.size === 0 ? true : activeFacilityIds.has(i.facilityId))
  );

  const isAdmin = user.role === UserRole.ADMIN;
  const scopedReservations = isAdmin
    ? safeReservations
    : safeReservations.filter((r) => r.userId === user.id);

  const scopedIssues = isAdmin
    ? safeIssues
    : safeIssues.filter((i) => i.reporterId === user.id);

  const pendingReservations = scopedReservations.filter(
    (r) => r.status === ReservationStatus.PENDING
  ).length;
  const confirmedReservations = scopedReservations.filter(
    (r) => r.status === ReservationStatus.CONFIRMED
  ).length;
  const openIssues = scopedIssues.filter(
    (i) => i.status === IssueStatus.OPEN || i.status === IssueStatus.IN_PROGRESS
  ).length;

  const upcomingSchedule = scopedReservations
    .filter(
      (r) =>
        (!todayIso || r.reservationDate >= todayIso) &&
        (r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.PENDING)
    )
    .sort((a, b) => {
      if (a.reservationDate !== b.reservationDate) {
        return a.reservationDate.localeCompare(b.reservationDate);
      }
      return a.startTime.localeCompare(b.startTime);
    })
    .slice(0, 6);

  const availableFacilitiesCount = safeFacilities.filter(
    (f) => f.isReservable !== false && f.status === FacilityStatus.AVAILABLE
  ).length;

  return {
    totalReservations: scopedReservations.length,
    pendingReservations,
    confirmedReservations,
    openIssues,
    totalIssues: scopedIssues.length,
    availableFacilitiesCount,
    totalFacilitiesCount: safeFacilities.length,
    upcomingSchedule,
  };
}

function getTimeBucketLabel(startTime) {
  try {
    const mins = toMinutes(startTime);
    if (mins < 11 * 60) return 'Morning (06:00–11:00)';
    if (mins < 14 * 60) return 'Midday (11:00–14:00)';
    if (mins < 18 * 60) return 'Afternoon (14:00–18:00)';
    return 'Evening (18:00–23:00)';
  } catch {
    return 'Unspecified';
  }
}

export function computeAdminAnalytics({
  reservations,
  issues,
  facilities,
  users,
  filters = {},
}) {
  const allFacilities = (Array.isArray(facilities) ? facilities : []).filter(
    (f) => !f.isArchived && !f.isDemo
  );
  const allReservations = (Array.isArray(reservations) ? reservations : []).filter(
    (r) => !r.isDemo
  );
  const allIssues = (Array.isArray(issues) ? issues : []).filter((i) => !i.isDemo);
  const allUsers = (Array.isArray(users) ? users : []).filter((u) => !u.isDemo);

  const categoryFilter = String(filters.category || '').trim();
  const floorFilter = String(filters.floor || '').trim();
  const statusFilter = String(filters.status || '').trim();
  const searchFilter = String(filters.search || '').trim().toLowerCase();
  const startDateFilter = String(filters.startDate || '').trim();
  const endDateFilter = String(filters.endDate || '').trim();

  const safeFacilities = allFacilities.filter((f) => {
    if (categoryFilter && categoryFilter !== 'All' && f.category !== categoryFilter) {
      return false;
    }
    if (floorFilter && floorFilter !== 'All' && floorFilter !== 'All Floors' && f.floor !== floorFilter) {
      return false;
    }
    if (searchFilter) {
      const hay = `${f.code} ${f.name} ${f.building} ${f.floor} ${f.category}`.toLowerCase();
      if (!hay.includes(searchFilter)) return false;
    }
    return true;
  });

  const allowedFacilityIds = new Set(safeFacilities.map((f) => f.id));

  const safeReservations = allReservations.filter((r) => {
    if (!allowedFacilityIds.has(r.facilityId)) return false;
    if (statusFilter && statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (startDateFilter && r.reservationDate < startDateFilter) return false;
    if (endDateFilter && r.reservationDate > endDateFilter) return false;
    return true;
  });

  const safeIssues = allIssues.filter((i) => {
    if (!allowedFacilityIds.has(i.facilityId)) return false;
    return true;
  });

  const reservationsByStatus = {
    Pending: 0,
    Confirmed: 0,
    Rejected: 0,
    Cancelled: 0,
    Completed: 0,
  };

  let confirmedScheduledHours = 0;
  let confirmedOrCompletedCount = 0;
  const activityByDate = new Map();
  const periodCounts = new Map([
    ['Morning (06:00–11:00)', { period: 'Morning (06:00–11:00)', shortLabel: '06–11', requests: 0, scheduledHours: 0 }],
    ['Midday (11:00–14:00)', { period: 'Midday (11:00–14:00)', shortLabel: '11–14', requests: 0, scheduledHours: 0 }],
    ['Afternoon (14:00–18:00)', { period: 'Afternoon (14:00–18:00)', shortLabel: '14–18', requests: 0, scheduledHours: 0 }],
    ['Evening (18:00–23:00)', { period: 'Evening (18:00–23:00)', shortLabel: '18–23', requests: 0, scheduledHours: 0 }],
  ]);

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayMap = new Map(WEEKDAYS.map((day) => [day, { day, requests: 0, confirmed: 0 }]));

  for (const res of safeReservations) {
    if (Object.prototype.hasOwnProperty.call(reservationsByStatus, res.status)) {
      reservationsByStatus[res.status] += 1;
    }

    let diffHours = 0;
    try {
      diffHours = (toMinutes(res.endTime) - toMinutes(res.startTime)) / 60;
    } catch {
      diffHours = 0;
    }

    const isConfirmedLike =
      res.status === ReservationStatus.CONFIRMED || res.status === ReservationStatus.COMPLETED;
    if (isConfirmedLike) {
      confirmedScheduledHours += diffHours;
      confirmedOrCompletedCount += 1;
    }

    // Activity over time grouped by actual reservationDate
    if (!activityByDate.has(res.reservationDate)) {
      activityByDate.set(res.reservationDate, {
        date: res.reservationDate,
        totalRequests: 0,
        confirmedCount: 0,
        pendingCount: 0,
        scheduledHours: 0,
      });
    }
    const dayEntry = activityByDate.get(res.reservationDate);
    dayEntry.totalRequests += 1;
    if (isConfirmedLike) {
      dayEntry.confirmedCount += 1;
      dayEntry.scheduledHours = Number((dayEntry.scheduledHours + diffHours).toFixed(1));
    }
    if (res.status === ReservationStatus.PENDING) {
      dayEntry.pendingCount += 1;
    }

    // Peak time window breakdown from actual startTime
    const bucketKey = getTimeBucketLabel(res.startTime);
    if (periodCounts.has(bucketKey)) {
      const bucket = periodCounts.get(bucketKey);
      bucket.requests += 1;
      if (isConfirmedLike) {
        bucket.scheduledHours = Number((bucket.scheduledHours + diffHours).toFixed(1));
      }
    }

    // Weekday distribution from actual reservationDate
    try {
      const dt = new Date(`${res.reservationDate}T00:00:00Z`);
      if (!Number.isNaN(dt.getTime())) {
        const dayName = WEEKDAYS[dt.getUTCDay()];
        const wd = weekdayMap.get(dayName);
        if (wd) {
          wd.requests += 1;
          if (isConfirmedLike) wd.confirmed += 1;
        }
      }
    } catch {
      // ignore invalid date
    }
  }

  const activityOverTime = Array.from(activityByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const peakBookingPeriods = Array.from(periodCounts.values());
  const weekdayDistribution = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) =>
    weekdayMap.get(d)
  );

  const issuesByStatus = {
    Open: 0,
    'In Progress': 0,
    Resolved: 0,
    Closed: 0,
  };
  const issuesByPriority = {
    Low: 0,
    Medium: 0,
    High: 0,
    Urgent: 0,
  };
  const issuesByCategory = {};

  for (const issue of safeIssues) {
    if (Object.prototype.hasOwnProperty.call(issuesByStatus, issue.status)) {
      issuesByStatus[issue.status] += 1;
    }
    if (Object.prototype.hasOwnProperty.call(issuesByPriority, issue.priority)) {
      issuesByPriority[issue.priority] += 1;
    }
    issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
  }

  const facilityBreakdown = safeFacilities.map((facility) => {
    const facilityReservations = safeReservations.filter((r) => r.facilityId === facility.id);
    const confirmedCount = facilityReservations.filter(
      (r) => r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.COMPLETED
    ).length;
    const pendingCount = facilityReservations.filter(
      (r) => r.status === ReservationStatus.PENDING
    ).length;
    const rejectedCount = facilityReservations.filter(
      (r) => r.status === ReservationStatus.REJECTED
    ).length;
    const cancelledCount = facilityReservations.filter(
      (r) => r.status === ReservationStatus.CANCELLED
    ).length;
    const facilityIssues = safeIssues.filter((i) => i.facilityId === facility.id);
    const openIssueCount = facilityIssues.filter(
      (i) => i.status === IssueStatus.OPEN || i.status === IssueStatus.IN_PROGRESS
    ).length;

    let scheduledHours = 0;
    for (const r of facilityReservations) {
      if (r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.COMPLETED) {
        try {
          scheduledHours += (toMinutes(r.endTime) - toMinutes(r.startTime)) / 60;
        } catch {
          // ignore
        }
      }
    }

    return {
      facilityId: facility.id,
      code: facility.code,
      name: facility.name,
      building: facility.building,
      floor: facility.floor,
      category: facility.category,
      capacity: facility.capacity,
      isReservable: facility.isReservable !== false,
      openHour: facility.openHour,
      closeHour: facility.closeHour,
      status: facility.status,
      totalRequests: facilityReservations.length,
      confirmedCount,
      pendingCount,
      rejectedCount,
      cancelledCount,
      scheduledHours: Number(scheduledHours.toFixed(1)),
      issueCount: facilityIssues.length,
      openIssueCount,
    };
  });

  const categoryMap = new Map();
  for (const row of facilityBreakdown) {
    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, {
        category: row.category,
        facilityCount: 0,
        totalRequests: 0,
        confirmedCount: 0,
        scheduledHours: 0,
        issueCount: 0,
      });
    }
    const c = categoryMap.get(row.category);
    c.facilityCount += 1;
    c.totalRequests += row.totalRequests;
    c.confirmedCount += row.confirmedCount;
    c.scheduledHours = Number((c.scheduledHours + row.scheduledHours).toFixed(1));
    c.issueCount += row.issueCount;
  }

  const usersByRole = {
    student: allUsers.filter((u) => u.role === UserRole.STUDENT).length,
    professor: allUsers.filter((u) => u.role === UserRole.PROFESSOR).length,
    admin: allUsers.filter((u) => u.role === UserRole.ADMIN).length,
  };

  const reviewedCount =
    reservationsByStatus.Confirmed +
    reservationsByStatus.Completed +
    reservationsByStatus.Rejected;

  const approvalRatePct =
    reviewedCount > 0
      ? Math.round(
          ((reservationsByStatus.Confirmed + reservationsByStatus.Completed) / reviewedCount) * 100
        )
      : null;

  const avgDurationHours =
    confirmedOrCompletedCount > 0
      ? Number((confirmedScheduledHours / confirmedOrCompletedCount).toFixed(1))
      : 0;

  return {
    totals: {
      facilities: safeFacilities.length,
      availableFacilities: safeFacilities.filter(
        (f) => f.isReservable !== false && f.status === FacilityStatus.AVAILABLE
      ).length,
      reservations: safeReservations.length,
      confirmedScheduledHours: Number(confirmedScheduledHours.toFixed(1)),
      avgDurationHours,
      approvalRatePct,
      issues: safeIssues.length,
      openIssues: issuesByStatus.Open + issuesByStatus['In Progress'],
      users: allUsers.length,
    },
    reservationsByStatus,
    issuesByStatus,
    issuesByPriority,
    issuesByCategory,
    usersByRole,
    facilityBreakdown,
    categoryUtilization: Array.from(categoryMap.values()),
    activityOverTime,
    peakBookingPeriods,
    weekdayDistribution,
    categoriesAvailable: Array.from(new Set(allFacilities.map((f) => f.category))).sort(),
    floorsAvailable: Array.from(new Set(allFacilities.map((f) => f.floor))).filter(Boolean),
    disclaimer:
      'Figures reflect recorded CICS Building reservations and confirmed scheduled hours only. Reservations do not assert physical room occupancy.',
  };
}
