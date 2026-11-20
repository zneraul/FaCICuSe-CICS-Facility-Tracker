/**
 * Outbound & Inbound Port Contracts for the FaCICuSe Application Core.
 * Concrete adapters in server/adapters/ must implement these contracts.
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
