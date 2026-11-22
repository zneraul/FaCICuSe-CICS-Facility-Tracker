/**
 * Application boundary contracts for the FaCICuSe Hexagonal Architecture.
 *
 * Inbound adapters call the use-case APIs declared below. Outbound adapters
 * implement the repository and service contracts declared after them.
 */

export function assertPortImplemented(port, methodNames, portName) {
  if (!port) {
    throw new Error(`Missing required port implementation: ${portName}`);
  }
  for (const method of methodNames) {
    if (typeof port[method] !== 'function') {
      throw new Error(`Port ${portName} must implement method "${method}()".`);
    }
  }
}

/**
 * Inbound application ports exposed by the use-case layer to HTTP/controllers.
 * The composition root validates these contracts before creating adapters.
 */
export const INBOUND_USE_CASE_PORT_METHODS = Object.freeze({
  facility: [
    'listPublicFacilities',
    'getPublicFacilityDetail',
    'listFacilitiesForUser',
    'getFacilityDetailForUser',
    'createFacility',
    'updateFacility',
    'deleteFacility',
  ],
  reservation: [
    'createReservationRequest',
    'getCalendarSchedule',
    'createAdminScheduleBlock',
    'rescheduleReservation',
    'listUserReservations',
    'cancelUserReservation',
    'listAllReservationsForAdmin',
    'reviewReservation',
  ],
  classSchedule: [
    'listPublicClassSchedules',
    'getTodaysClassSchedules',
    'listAdminClassSchedules',
    'createClassSchedule',
    'updateClassSchedule',
    'verifyClassSchedule',
    'deleteClassSchedule',
  ],
  maintenance: [
    'submitMaintenanceIssue',
    'listMaintenanceIssues',
    'updateMaintenanceIssueForAdmin',
  ],
  user: [
    'authenticateWithEmailPassword',
    'setOwnPassword',
    'syncVerifiedGoogleUser',
    'updateOwnProfile',
    'listUsersForAdmin',
    'updateUserForAdmin',
  ],
  dashboard: [
    'getRoleDashboard',
    'getNotificationsForUser',
    'markNotificationRead',
  ],
  analytics: [
    'getAdminAnalytics',
    'exportReservationsCsv',
  ],
});

export const FACILITY_REPO_METHODS = [
  'listAll',
  'findById',
  'findByCode',
  'create',
  'update',
  'remove',
];

export const RESERVATION_REPO_METHODS = [
  'listAll',
  'listByUserId',
  'listByFacilityAndDate',
  'findById',
  'createWithConflictCheck',
  'updateStatus',
  'rescheduleWithConflictCheck',
];

export const ISSUE_REPO_METHODS = [
  'listAll',
  'listByReporterId',
  'findById',
  'create',
  'updateStatus',
];

export const USER_REPO_METHODS = [
  'listAll',
  'findByUid',
  'findByEmail',
  'findAuthRecordByEmail',
  'setPasswordByUid',
  'findById',
  'findByVerificationTokenHash',
  'createPasswordUser',
  'markEmailVerified',
  'updateVerificationToken',
  'upsertVerifiedUser',
  'updateUserAccount',
  'updateProfile',
];

export const NOTIFICATION_PORT_METHODS = [
  'listByUserId',
  'create',
  'markAsRead',
  'markAllAsRead',
];

export const AUDIT_LOG_PORT_METHODS = [
  'record',
  'listRecent',
];

export const CLASS_SCHEDULE_REPO_METHODS = [
  'listAll',
  'listByDayOfWeek',
  'listByFacilityAndDay',
  'findById',
  'findBySeedKey',
  'createWithConflictCheck',
  'updateWithConflictCheck',
  'updateVerificationStatus',
  'remove',
];
