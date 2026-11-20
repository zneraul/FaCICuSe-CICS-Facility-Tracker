import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SESSION_COOKIE_NAME } from './authMiddleware.js';
import { ensureFacilityCatalog } from '../outbound/seedService.js';
import { getPublicProjectInfo } from '../../domain/projectInfo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

function readPublicFirebaseWebConfig() {
  try {
    const configPath = path.join(rootDir, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!parsed?.apiKey || !parsed?.authDomain || !parsed?.projectId) return null;
    return {
      apiKey: parsed.apiKey,
      authDomain: parsed.authDomain,
      projectId: parsed.projectId,
      appId: parsed.appId || '',
      firestoreDatabaseId: parsed.firestoreDatabaseId || '',
    };
  } catch {
    return null;
  }
}

export function createHttpControllers({
  facilityUseCases,
  reservationUseCases,
  classScheduleUseCases,
  maintenanceUseCases,
  userUseCases,
  dashboardUseCases,
  analyticsUseCases,
  authProvider,
  domainPolicy,
}) {
  const publicFirebaseConfig = readPublicFirebaseWebConfig();

  function isHttpsRequest(req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    return Boolean(req.secure || String(proto).split(',')[0].trim() === 'https');
  }

  function serializeSessionUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      academicBlock: user.academicBlock || null,
      authProvider: user.authProvider || 'google',
      emailVerified: user.emailVerified !== false,
    };
  }

  return {
    async health(_req, res) {
      res.json({ ok: true, service: 'FaCICuSe' });
    },

    async getProjectInfo(_req, res) {
      res.json(getPublicProjectInfo());
    },

    async getAuthConfig(_req, res) {
      res.json({
        allowedDomainsConfigured: domainPolicy.isConfigured(),
        allowedDomains: domainPolicy.allowedDomains,
        firebaseConfig: publicFirebaseConfig,
      });
    },

    async loginWithEmail(req, res) {
      await ensureFacilityCatalog();
      const user = await userUseCases.authenticateWithEmailPassword(req.body || {});
      const isHttps = isHttpsRequest(req);
      const token = authProvider.issueSessionToken(user.uid, 'user');

      res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        path: '/',
        maxAge: 1000 * 60 * 60 * 24,
      });

      res.json({ user: serializeSessionUser(user) });
    },

    async createGoogleSession(req, res) {
      if (!req.actor?.uid) {
        return res.status(401).json({ error: 'Unable to establish a session for this account.' });
      }

      const token = authProvider.issueSessionToken(req.actor.uid, 'user');
      const isHttps = isHttpsRequest(req);
      res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        path: '/',
        maxAge: 1000 * 60 * 60 * 24,
      });

      res.json({ user: serializeSessionUser(req.actor) });
    },

    async setOwnPassword(req, res) {
      await userUseCases.setOwnPassword(req.actor, req.body || {});
      res.json({ ok: true });
    },

    async clearSession(req, res) {
      const isHttps = isHttpsRequest(req);
      const cookieOpts = {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        path: '/',
      };
      res.clearCookie(SESSION_COOKIE_NAME, cookieOpts);
      res.json({ ok: true });
    },

    async getSessionStatus(req, res) {
      res.json({
        user: serializeSessionUser(req.actor),
      });
    },

    async getCurrentUser(req, res) {
      res.json({
        user: serializeSessionUser(req.actor),
      });
    },

    async updateOwnProfile(req, res) {
      const updated = await userUseCases.updateOwnProfile(req.actor, req.body || {});
      res.json({ user: serializeSessionUser(updated) });
    },

    async listPublicFacilities(req, res) {
      await ensureFacilityCatalog();
      const items = await facilityUseCases.listPublicFacilities(req.query);
      res.json({ facilities: items });
    },

    async getPublicFacilityDetail(req, res) {
      await ensureFacilityCatalog();
      const detail = await facilityUseCases.getPublicFacilityDetail(
        req.params.id,
        req.query.date
      );
      res.json(detail);
    },

    async listPublicClassSchedules(req, res) {
      await ensureFacilityCatalog();
      const data = await classScheduleUseCases.listPublicClassSchedules(req.query || {});
      res.json(data);
    },

    async getPublicTodaysClassSchedules(req, res) {
      await ensureFacilityCatalog();
      const data = await classScheduleUseCases.getTodaysClassSchedules(req.query?.date);
      res.json(data);
    },

    async listClassSchedules(req, res) {
      await ensureFacilityCatalog();
      const data = await classScheduleUseCases.listPublicClassSchedules(req.query || {});
      res.json(data);
    },

    async getTodaysClassSchedules(req, res) {
      await ensureFacilityCatalog();
      const data = await classScheduleUseCases.getTodaysClassSchedules(req.query?.date);
      res.json(data);
    },

    async getDashboard(req, res) {
      await ensureFacilityCatalog();
      const data = await dashboardUseCases.getRoleDashboard(req.actor);
      res.json(data);
    },

    async listNotifications(req, res) {
      const items = await dashboardUseCases.getNotificationsForUser(req.actor);
      res.json({ notifications: items });
    },

    async markNotificationRead(req, res) {
      const result = await dashboardUseCases.markNotificationRead(
        req.actor,
        req.params.id
      );
      res.json(result);
    },

    async listFacilities(req, res) {
      await ensureFacilityCatalog();
      const items = await facilityUseCases.listFacilitiesForUser(req.actor, req.query);
      res.json({ facilities: items });
    },

    async getFacilityDetail(req, res) {
      await ensureFacilityCatalog();
      const detail = await facilityUseCases.getFacilityDetailForUser(
        req.actor,
        req.params.id,
        req.query.date
      );
      res.json(detail);
    },

    async listMyReservations(req, res) {
      await ensureFacilityCatalog();
      const items = await reservationUseCases.listUserReservations(
        req.actor,
        req.query.status
      );
      res.json({ reservations: items });
    },

    async getCalendarSchedule(req, res) {
      await ensureFacilityCatalog();
      const calendar = await reservationUseCases.getCalendarSchedule(req.actor, req.query || {});
      res.json(calendar);
    },

    async createReservation(req, res) {
      const created = await reservationUseCases.createReservationRequest(
        req.actor,
        req.body || {}
      );
      res.status(201).json({ reservation: created });
    },

    async cancelReservation(req, res) {
      const updated = await reservationUseCases.cancelUserReservation(
        req.actor,
        req.params.id
      );
      res.json({ reservation: updated });
    },

    async listIssues(req, res) {
      await ensureFacilityCatalog();
      const items = await maintenanceUseCases.listMaintenanceIssues(
        req.actor,
        req.query.status
      );
      res.json({ issues: items });
    },

    async createIssue(req, res) {
      const created = await maintenanceUseCases.submitMaintenanceIssue(
        req.actor,
        req.body || {}
      );
      res.status(201).json({ issue: created });
    },

    // System Administrator Controllers
    async adminCreateFacility(req, res) {
      const created = await facilityUseCases.createFacility(req.actor, req.body || {});
      res.status(201).json({ facility: created });
    },

    async adminUpdateFacility(req, res) {
      const updated = await facilityUseCases.updateFacility(
        req.actor,
        req.params.id,
        req.body || {}
      );
      res.json({ facility: updated });
    },

    async adminDeleteFacility(req, res) {
      const result = await facilityUseCases.deleteFacility(req.actor, req.params.id);
      res.json(result);
    },

    async adminListReservations(req, res) {
      await ensureFacilityCatalog();
      const items = await reservationUseCases.listAllReservationsForAdmin(
        req.actor,
        req.query.status
      );
      res.json({ reservations: items });
    },

    async adminCreateSchedule(req, res) {
      const created = await reservationUseCases.createAdminScheduleBlock(
        req.actor,
        req.body || {}
      );
      res.status(201).json({ reservation: created });
    },

    async adminReviewReservation(req, res) {
      const updated = await reservationUseCases.reviewReservation(
        req.actor,
        req.params.id,
        req.body || {}
      );
      res.json({ reservation: updated });
    },

    async adminRescheduleReservation(req, res) {
      const updated = await reservationUseCases.rescheduleReservation(
        req.actor,
        req.params.id,
        req.body || {}
      );
      res.json({ reservation: updated });
    },

    async adminListClassSchedules(req, res) {
      await ensureFacilityCatalog();
      const data = await classScheduleUseCases.listAdminClassSchedules(
        req.actor,
        req.query || {}
      );
      res.json(data);
    },

    async adminCreateClassSchedule(req, res) {
      await ensureFacilityCatalog();
      const created = await classScheduleUseCases.createClassSchedule(
        req.actor,
        req.body || {}
      );
      res.status(201).json({ schedule: created });
    },

    async adminUpdateClassSchedule(req, res) {
      await ensureFacilityCatalog();
      const updated = await classScheduleUseCases.updateClassSchedule(
        req.actor,
        req.params.id,
        req.body || {}
      );
      res.json({ schedule: updated });
    },

    async adminVerifyClassSchedule(req, res) {
      await ensureFacilityCatalog();
      const updated = await classScheduleUseCases.verifyClassSchedule(
        req.actor,
        req.params.id,
        req.body || {}
      );
      res.json({ schedule: updated });
    },

    async adminDeleteClassSchedule(req, res) {
      await ensureFacilityCatalog();
      const result = await classScheduleUseCases.deleteClassSchedule(
        req.actor,
        req.params.id
      );
      res.json(result);
    },

    async adminUpdateIssue(req, res) {
      const updated = await maintenanceUseCases.updateMaintenanceIssueForAdmin(
        req.actor,
        req.params.id,
        req.body || {}
      );
      res.json({ issue: updated });
    },

    async adminListUsers(req, res) {
      await ensureFacilityCatalog();
      const items = await userUseCases.listUsersForAdmin(req.actor);
      res.json({ users: items });
    },

    async adminUpdateUser(req, res) {
      const updated = await userUseCases.updateUserForAdmin(
        req.actor,
        req.params.id,
        req.body || {}
      );
      res.json({ user: updated });
    },

    async adminGetAnalytics(req, res) {
      await ensureFacilityCatalog();
      const analytics = await analyticsUseCases.getAdminAnalytics(req.actor, req.query || {});
      res.json(analytics);
    },

    async adminExportCsv(req, res) {
      await ensureFacilityCatalog();
      const csv = await analyticsUseCases.exportReservationsCsv(req.actor);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="facicuse-reservations-report.csv"'
      );
      res.send(csv);
    },
  };
}
