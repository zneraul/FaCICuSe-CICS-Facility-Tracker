import { assertCanAccessAnalytics, computeAdminAnalytics } from '../../domain/rules.js';

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function createAnalyticsUseCases({
  facilityRepo,
  reservationRepo,
  issueRepo,
  userRepo,
  auditLogPort,
}) {
  return {
    async getAdminAnalytics(actor, filters = {}) {
      assertCanAccessAnalytics(actor.role);

      const [facilities, reservations, issues, users, auditLogs] = await Promise.all([
        facilityRepo.listAll(),
        reservationRepo.listAll(),
        issueRepo.listAll(),
        userRepo.listAll(),
        auditLogPort.listRecent(30),
      ]);

      const analytics = computeAdminAnalytics({
        reservations,
        issues,
        facilities,
        users,
        filters,
      });

      return {
        ...analytics,
        auditLogs,
        appliedFilters: filters,
      };
    },

    async exportReservationsCsv(actor) {
      assertCanAccessAnalytics(actor.role);

      const reservations = (await reservationRepo.listAll()).filter((r) => !r.isDemo);
      const headers = [
        'Reservation ID',
        'Facility Code',
        'Facility Name',
        'Floor',
        'Requester',
        'Requester Role',
        'Academic Block',
        'Date',
        'Start Time',
        'End Time',
        'Attendees',
        'Status',
        'Purpose',
      ];

      const lines = [headers.map(escapeCsvCell).join(',')];
      for (const r of reservations) {
        lines.push(
          [
            r.id,
            r.facilityCode || '',
            r.facilityName || '',
            r.facilityFloor || '',
            r.userFullName || r.userEmail || '',
            r.userRole || '',
            r.academicBlock || '',
            r.reservationDate,
            r.startTime,
            r.endTime,
            r.attendeesCount,
            r.status,
            r.purpose,
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      await auditLogPort.record({
        actorUserId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'ANALYTICS_CSV_EXPORTED',
        entityType: 'analytics',
        entityId: 'reservations_report',
        details: `Exported ${reservations.length} reservation records to CSV`,
      });

      return lines.join('\n');
    },
  };
}
