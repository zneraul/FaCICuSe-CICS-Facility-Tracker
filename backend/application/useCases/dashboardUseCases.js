import { computeDashboardMetrics } from '../../domain/rules.js';
import { UserRole } from '../../domain/entities.js';
import {
  NON_INSTRUCTIONAL_WEEKDAYS,
  getManilaTodayIso,
  getManilaWeekday,
  sortClassSchedules,
} from '../../domain/classSchedule.js';
import { formatPublicClassScheduleDto } from './classScheduleUseCases.js';

export function createDashboardUseCases({
  facilityRepo,
  reservationRepo,
  classScheduleRepo = null,
  issueRepo,
  notificationPort,
}) {
  return {
    async getRoleDashboard(actor) {
      const todayIso = getManilaTodayIso();
      const weekday = getManilaWeekday(todayIso);
      const isNonInstructionalDay =
        NON_INSTRUCTIONAL_WEEKDAYS.includes(weekday) || weekday === 'Sunday';

      const [facilities, reservations, issues, notifications, todayClassRows] = await Promise.all([
        facilityRepo.listAll(),
        actor.role === UserRole.ADMIN
          ? reservationRepo.listAll()
          : reservationRepo.listByUserId(actor.id),
        actor.role === UserRole.ADMIN
          ? issueRepo.listAll()
          : issueRepo.listByReporterId(actor.id),
        notificationPort.listByUserId(actor.id),
        classScheduleRepo && !isNonInstructionalDay
          ? classScheduleRepo.listByDayOfWeek(weekday)
          : Promise.resolve([]),
      ]);

      const metrics = computeDashboardMetrics({
        reservations,
        issues,
        facilities,
        user: actor,
        todayIso,
      });

      return {
        user: {
          id: actor.id,
          email: actor.email,
          fullName: actor.fullName,
          role: actor.role,
          department: actor.department,
          academicBlock: actor.academicBlock || null,
        },
        metrics,
        todaysClassSchedule: {
          weekday,
          manilaDate: todayIso,
          isNonInstructionalDay,
          nonInstructionalWeekdays: [...NON_INSTRUCTIONAL_WEEKDAYS],
          schedules: sortClassSchedules(todayClassRows).map(formatPublicClassScheduleDto),
        },
        recentIssues: issues.slice(0, 5),
        unreadNotificationsCount: notifications.filter((n) => !n.isRead).length,
      };
    },

    async getNotificationsForUser(actor) {
      return notificationPort.listByUserId(actor.id);
    },

    async markNotificationRead(actor, notificationId) {
      if (notificationId === 'all') {
        await notificationPort.markAllAsRead(actor.id);
        return { updated: true };
      }
      await notificationPort.markAsRead(actor.id, Number(notificationId));
      return { updated: true };
    },
  };
}
