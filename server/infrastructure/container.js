import { EmailDomainPolicy } from '../domain/valueObjects.js';
import {
  AUDIT_LOG_PORT_METHODS,
  CLASS_SCHEDULE_REPO_METHODS,
  FACILITY_REPO_METHODS,
  ISSUE_REPO_METHODS,
  NOTIFICATION_PORT_METHODS,
  RESERVATION_REPO_METHODS,
  USER_REPO_METHODS,
  assertPortImplemented,
} from '../application/ports.js';
import { createFacilityUseCases } from '../application/useCases/facilityUseCases.js';
import { createReservationUseCases } from '../application/useCases/reservationUseCases.js';
import { createClassScheduleUseCases } from '../application/useCases/classScheduleUseCases.js';
import { createMaintenanceUseCases } from '../application/useCases/maintenanceUseCases.js';
import { createUserUseCases } from '../application/useCases/userUseCases.js';
import { createDashboardUseCases } from '../application/useCases/dashboardUseCases.js';
import { createAnalyticsUseCases } from '../application/useCases/analyticsUseCases.js';
import { createPostgresAdapters } from '../adapters/outbound/postgresRepositories.js';
import { createLocalStoreAdapters } from '../adapters/outbound/localStoreRepositories.js';
import { createAuthProviderAdapter } from '../adapters/outbound/firebaseAuthAdapter.js';
import * as passwordHasher from '../adapters/outbound/passwordHasher.js';
import { createAuthMiddleware } from '../adapters/inbound/authMiddleware.js';
import { createHttpControllers } from '../adapters/inbound/httpControllers.js';
import { createApiRouter } from '../adapters/inbound/routes.js';

export function buildApplicationContainer(config) {
  // 1. Outbound Adapters (Hexagonal Ports & Adapters)
  const adapters =
    config.storageMode === 'postgres'
      ? createPostgresAdapters()
      : createLocalStoreAdapters();

  const {
    facilityRepo,
    reservationRepo,
    classScheduleRepo,
    issueRepo,
    userRepo,
    notificationPort,
    auditLogPort,
  } = adapters;

  assertPortImplemented(facilityRepo, FACILITY_REPO_METHODS, 'FacilityRepositoryPort');
  assertPortImplemented(reservationRepo, RESERVATION_REPO_METHODS, 'ReservationRepositoryPort');
  assertPortImplemented(classScheduleRepo, CLASS_SCHEDULE_REPO_METHODS, 'ClassScheduleRepositoryPort');
  assertPortImplemented(issueRepo, ISSUE_REPO_METHODS, 'IssueRepositoryPort');
  assertPortImplemented(userRepo, USER_REPO_METHODS, 'UserRepositoryPort');
  assertPortImplemented(notificationPort, NOTIFICATION_PORT_METHODS, 'NotificationPort');
  assertPortImplemented(auditLogPort, AUDIT_LOG_PORT_METHODS, 'AuditLogPort');

  const authProvider = createAuthProviderAdapter({
    sessionSecret: config.sessionSecret,
  });

  const domainPolicy = new EmailDomainPolicy(config.allowedUniversityDomains);

  // 2. Application Core Use Cases
  const facilityUseCases = createFacilityUseCases({
    facilityRepo,
    reservationRepo,
    classScheduleRepo,
    issueRepo,
    auditLogPort,
  });

  const reservationUseCases = createReservationUseCases({
    facilityRepo,
    reservationRepo,
    classScheduleRepo,
    userRepo,
    notificationPort,
    auditLogPort,
  });

  const classScheduleUseCases = createClassScheduleUseCases({
    classScheduleRepo,
    facilityRepo,
    auditLogPort,
  });

  const maintenanceUseCases = createMaintenanceUseCases({
    facilityRepo,
    issueRepo,
    userRepo,
    notificationPort,
    auditLogPort,
  });

  const userUseCases = createUserUseCases({
    userRepo,
    auditLogPort,
    domainPolicy,
    passwordHasher,
    adminBootstrapEmails: config.adminBootstrapEmails,
  });

  const dashboardUseCases = createDashboardUseCases({
    facilityRepo,
    reservationRepo,
    classScheduleRepo,
    issueRepo,
    notificationPort,
  });

  const analyticsUseCases = createAnalyticsUseCases({
    facilityRepo,
    reservationRepo,
    issueRepo,
    userRepo,
    auditLogPort,
  });

  // 3. Inbound Adapters
  const authMiddleware = createAuthMiddleware({
    authProvider,
    userRepo,
    userUseCases,
  });

  const controllers = createHttpControllers({
    facilityUseCases,
    reservationUseCases,
    classScheduleUseCases,
    maintenanceUseCases,
    userUseCases,
    dashboardUseCases,
    analyticsUseCases,
    authProvider,
    domainPolicy,
  });

  const apiRouter = createApiRouter({
    controllers,
    authMiddleware,
  });

  return {
    apiRouter,
  };
}
