import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../src/db/index.ts';
import {
  auditLogs,
  classSchedules,
  facilities,
  maintenanceIssues,
  notifications,
  reservations,
  users,
} from '../../../src/db/schema.ts';
import { ACTIVE_BLOCKING_STATUSES } from '../../domain/entities.js';
import { ConflictError } from '../../domain/errors.js';
import { TimeSlot } from '../../domain/valueObjects.js';
import {
  assertNoClassScheduleConflicts,
  assertNoReservationClassScheduleConflict,
  formatVerificationStatusLabel,
  getManilaWeekday,
  sortClassSchedules,
} from '../../domain/classSchedule.js';

function wrapDbError(action, error) {
  if (error instanceof ConflictError) {
    throw error;
  }
  console.error(`[DB Error] ${action}:`, error);
  throw new Error(`Database operation failed during ${action}.`, { cause: error });
}

export function createPostgresAdapters() {
  const facilityRepo = {
    async listAll() {
      try {
        return await db
          .select()
          .from(facilities)
          .where(and(eq(facilities.isArchived, false), eq(facilities.isDemo, false)))
          .orderBy(asc(facilities.id));
      } catch (error) {
        wrapDbError('list facilities', error);
      }
    },

    async findById(id) {
      try {
        const rows = await db.select().from(facilities).where(eq(facilities.id, id));
        return rows[0] || null;
      } catch (error) {
        wrapDbError('find facility by id', error);
      }
    },

    async findByCode(code) {
      try {
        const rows = await db.select().from(facilities).where(eq(facilities.code, code));
        return rows[0] || null;
      } catch (error) {
        wrapDbError('find facility by code', error);
      }
    },

    async create(data) {
      try {
        const rows = await db.insert(facilities).values(data).returning();
        return rows[0];
      } catch (error) {
        wrapDbError('create facility', error);
      }
    },

    async update(id, data) {
      try {
        const rows = await db
          .update(facilities)
          .set(data)
          .where(eq(facilities.id, id))
          .returning();
        return rows[0] || null;
      } catch (error) {
        wrapDbError('update facility', error);
      }
    },

    async remove(id) {
      try {
        await db
          .update(facilities)
          .set({ isArchived: true, isReservable: false, status: 'Restricted' })
          .where(eq(facilities.id, id));
        return true;
      } catch (error) {
        wrapDbError('archive facility', error);
      }
    },
  };

  async function enrichReservations(rows) {
    if (!rows.length) return [];
    const [allFacilities, allUsers] = await Promise.all([
      db.select().from(facilities),
      db.select().from(users),
    ]);
    const facilityMap = new Map(allFacilities.map((f) => [f.id, f]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return rows.map((r) => {
      const f = facilityMap.get(r.facilityId);
      const u = userMap.get(r.userId);
      return {
        ...r,
        facilityCode: f?.code || '',
        facilityName: f?.name || 'Unknown Facility',
        facilityBuilding: f?.building || '',
        facilityFloor: f?.floor || '',
        facilityCategory: f?.category || '',
        facilityImageUrl: f?.imageUrl || '',
        facilityIsArchived: Boolean(f?.isArchived),
        userFullName: u?.fullName || 'Unknown User',
        userEmail: u?.email || '',
        userRole: u?.role || '',
        userAcademicBlock: u?.academicBlock || null,
      };
    });
  }

  const reservationRepo = {
    async listAll() {
      try {
        const rows = await db
          .select()
          .from(reservations)
          .where(eq(reservations.isDemo, false))
          .orderBy(desc(reservations.reservationDate), asc(reservations.startTime));
        const enriched = await enrichReservations(rows);
        return enriched.filter((r) => !r.facilityIsArchived);
      } catch (error) {
        wrapDbError('list all reservations', error);
      }
    },

    async listByUserId(userId) {
      try {
        const rows = await db
          .select()
          .from(reservations)
          .where(and(eq(reservations.userId, userId), eq(reservations.isDemo, false)))
          .orderBy(desc(reservations.reservationDate), asc(reservations.startTime));
        const enriched = await enrichReservations(rows);
        return enriched.filter((r) => !r.facilityIsArchived);
      } catch (error) {
        wrapDbError('list user reservations', error);
      }
    },

    async listByFacilityAndDate(facilityId, reservationDate) {
      try {
        return await db
          .select()
          .from(reservations)
          .where(
            and(
              eq(reservations.facilityId, facilityId),
              eq(reservations.reservationDate, reservationDate),
              eq(reservations.isDemo, false)
            )
          )
          .orderBy(asc(reservations.startTime));
      } catch (error) {
        wrapDbError('list facility schedule', error);
      }
    },

    async findById(id) {
      try {
        const rows = await db.select().from(reservations).where(eq(reservations.id, id));
        const enriched = await enrichReservations(rows);
        return enriched[0] || null;
      } catch (error) {
        wrapDbError('find reservation', error);
      }
    },

    async createWithConflictCheck(data) {
      try {
        const created = await db.transaction(async (tx) => {
          const sameDay = await tx
            .select()
            .from(reservations)
            .where(
              and(
                eq(reservations.facilityId, data.facilityId),
                eq(reservations.reservationDate, data.reservationDate),
                inArray(reservations.status, ACTIVE_BLOCKING_STATUSES)
              )
            );

          const requestedSlot = new TimeSlot(
            data.reservationDate,
            data.startTime,
            data.endTime
          );
          const conflict = sameDay.find((item) => {
            const existingSlot = new TimeSlot(
              item.reservationDate,
              item.startTime,
              item.endTime
            );
            return requestedSlot.overlapsWith(existingSlot);
          });

          if (conflict) {
            throw new ConflictError(
              `Time slot overlaps with an existing ${conflict.status.toLowerCase()} booking (${conflict.startTime}–${conflict.endTime}).`
            );
          }

          const weekday = getManilaWeekday(data.reservationDate);
          const facilityClasses = await tx
            .select()
            .from(classSchedules)
            .where(
              and(
                eq(classSchedules.facilityId, data.facilityId),
                eq(classSchedules.dayOfWeek, weekday)
              )
            );
          if (facilityClasses.length > 0) {
            const facRows = await tx
              .select()
              .from(facilities)
              .where(eq(facilities.id, data.facilityId));
            assertNoReservationClassScheduleConflict({
              facility: facRows[0] || { id: data.facilityId },
              reservationDate: data.reservationDate,
              startTime: data.startTime,
              endTime: data.endTime,
              classSchedules: facilityClasses,
            });
          }

          const inserted = await tx.insert(reservations).values(data).returning();
          return inserted[0];
        });

        const enriched = await enrichReservations([created]);
        return enriched[0];
      } catch (error) {
        wrapDbError('create reservation', error);
      }
    },

    async updateStatus(id, { status, reviewerId, reviewNote }) {
      try {
        const rows = await db
          .update(reservations)
          .set({
            status,
            reviewerId: reviewerId ?? null,
            reviewNote: reviewNote ?? null,
            updatedAt: new Date(),
          })
          .where(eq(reservations.id, id))
          .returning();
        const enriched = await enrichReservations(rows);
        return enriched[0] || null;
      } catch (error) {
        wrapDbError('update reservation status', error);
      }
    },

    async rescheduleWithConflictCheck(
      id,
      { facilityId, reservationDate, startTime, endTime, reviewerId, reviewNote }
    ) {
      try {
        const updated = await db.transaction(async (tx) => {
          const sameDay = await tx
            .select()
            .from(reservations)
            .where(
              and(
                eq(reservations.facilityId, facilityId),
                eq(reservations.reservationDate, reservationDate),
                inArray(reservations.status, ACTIVE_BLOCKING_STATUSES)
              )
            );

          const requestedSlot = new TimeSlot(reservationDate, startTime, endTime);
          const conflict = sameDay.find((item) => {
            if (item.id === id) return false;
            const existingSlot = new TimeSlot(
              item.reservationDate,
              item.startTime,
              item.endTime
            );
            return requestedSlot.overlapsWith(existingSlot);
          });

          if (conflict) {
            throw new ConflictError(
              `Time slot overlaps with an existing ${conflict.status.toLowerCase()} booking (${conflict.startTime}–${conflict.endTime}).`
            );
          }

          const weekday = getManilaWeekday(reservationDate);
          const facilityClasses = await tx
            .select()
            .from(classSchedules)
            .where(
              and(
                eq(classSchedules.facilityId, facilityId),
                eq(classSchedules.dayOfWeek, weekday)
              )
            );
          if (facilityClasses.length > 0) {
            const facRows = await tx
              .select()
              .from(facilities)
              .where(eq(facilities.id, facilityId));
            assertNoReservationClassScheduleConflict({
              facility: facRows[0] || { id: facilityId },
              reservationDate,
              startTime,
              endTime,
              classSchedules: facilityClasses,
            });
          }

          const rows = await tx
            .update(reservations)
            .set({
              facilityId,
              reservationDate,
              startTime,
              endTime,
              reviewerId: reviewerId ?? null,
              reviewNote: reviewNote ?? null,
              updatedAt: new Date(),
            })
            .where(eq(reservations.id, id))
            .returning();
          return rows[0] || null;
        });

        if (!updated) return null;
        const enriched = await enrichReservations([updated]);
        return enriched[0];
      } catch (error) {
        wrapDbError('reschedule reservation', error);
      }
    },
  };

  async function enrichIssues(rows) {
    if (!rows.length) return [];
    const [allFacilities, allUsers] = await Promise.all([
      db.select().from(facilities),
      db.select().from(users),
    ]);
    const facilityMap = new Map(allFacilities.map((f) => [f.id, f]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return rows.map((issue) => {
      const f = facilityMap.get(issue.facilityId);
      const u = userMap.get(issue.reporterId);
      return {
        ...issue,
        facilityCode: f?.code || '',
        facilityName: f?.name || 'Unknown Facility',
        facilityBuilding: f?.building || '',
        facilityFloor: f?.floor || '',
        facilityIsArchived: Boolean(f?.isArchived),
        reporterName: u?.fullName || 'Unknown Reporter',
        reporterEmail: u?.email || '',
        reporterRole: u?.role || '',
      };
    });
  }

  const issueRepo = {
    async listAll() {
      try {
        const rows = await db
          .select()
          .from(maintenanceIssues)
          .where(eq(maintenanceIssues.isDemo, false))
          .orderBy(desc(maintenanceIssues.createdAt));
        const enriched = await enrichIssues(rows);
        return enriched.filter((i) => !i.facilityIsArchived);
      } catch (error) {
        wrapDbError('list all issues', error);
      }
    },

    async listByReporterId(reporterId) {
      try {
        const rows = await db
          .select()
          .from(maintenanceIssues)
          .where(and(eq(maintenanceIssues.reporterId, reporterId), eq(maintenanceIssues.isDemo, false)))
          .orderBy(desc(maintenanceIssues.createdAt));
        const enriched = await enrichIssues(rows);
        return enriched.filter((i) => !i.facilityIsArchived);
      } catch (error) {
        wrapDbError('list user issues', error);
      }
    },

    async findById(id) {
      try {
        const rows = await db
          .select()
          .from(maintenanceIssues)
          .where(eq(maintenanceIssues.id, id));
        const enriched = await enrichIssues(rows);
        return enriched[0] || null;
      } catch (error) {
        wrapDbError('find issue by id', error);
      }
    },

    async create(data) {
      try {
        const rows = await db.insert(maintenanceIssues).values(data).returning();
        const enriched = await enrichIssues(rows);
        return enriched[0];
      } catch (error) {
        wrapDbError('create maintenance issue', error);
      }
    },

    async updateStatus(id, { status, actionTaken, assignedTo }) {
      try {
        const rows = await db
          .update(maintenanceIssues)
          .set({
            status,
            actionTaken: actionTaken ?? null,
            assignedTo: assignedTo ?? null,
            updatedAt: new Date(),
          })
          .where(eq(maintenanceIssues.id, id))
          .returning();
        const enriched = await enrichIssues(rows);
        return enriched[0] || null;
      } catch (error) {
        wrapDbError('update maintenance issue', error);
      }
    },
  };

  function sanitizePublicUser(user) {
    if (!user) return null;
    const {
      passwordHash: _passwordHash,
      verificationTokenHash: _verificationTokenHash,
      verificationTokenExpiresAt: _verificationTokenExpiresAt,
      ...safe
    } = user;
    return safe;
  }

  const userRepo = {
    async listAll() {
      try {
        const rows = await db
          .select()
          .from(users)
          .where(eq(users.isDemo, false))
          .orderBy(asc(users.role), asc(users.fullName));
        return rows.map(sanitizePublicUser);
      } catch (error) {
        wrapDbError('list users', error);
      }
    },

    async findByUid(uid) {
      try {
        const rows = await db.select().from(users).where(eq(users.uid, uid));
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('find user by uid', error);
      }
    },

    async findByEmail(email) {
      try {
        const normalized = String(email || '').trim().toLowerCase();
        const rows = await db.select().from(users).where(eq(users.email, normalized));
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('find user by email', error);
      }
    },

    async findAuthRecordByEmail(email) {
      try {
        const normalized = String(email || '').trim().toLowerCase();
        const rows = await db.select().from(users).where(eq(users.email, normalized));
        return rows[0] || null;
      } catch (error) {
        wrapDbError('find auth record by email', error);
      }
    },

    async findById(id) {
      try {
        const rows = await db.select().from(users).where(eq(users.id, id));
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('find user by id', error);
      }
    },

    async findByVerificationTokenHash(tokenHash) {
      try {
        const rows = await db
          .select()
          .from(users)
          .where(eq(users.verificationTokenHash, tokenHash));
        return rows[0] || null;
      } catch (error) {
        wrapDbError('find user by verification token', error);
      }
    },

    async createPasswordUser({
      uid,
      email,
      fullName,
      role,
      department,
      academicBlock,
      passwordHash,
      verificationTokenHash,
      verificationTokenExpiresAt,
    }) {
      try {
        const normalizedEmail = String(email).trim().toLowerCase();
        const existing = await db.select().from(users).where(eq(users.email, normalizedEmail));
        if (existing.length > 0) {
          throw new ConflictError('An account with this university email already exists.');
        }
        const rows = await db
          .insert(users)
          .values({
            uid,
            email: normalizedEmail,
            fullName,
            role,
            department: department || 'College of Informatics and Computing Sciences (CICS)',
            academicBlock: academicBlock || null,
            authProvider: 'password',
            emailVerified: false,
            passwordHash,
            verificationTokenHash,
            verificationTokenExpiresAt: verificationTokenExpiresAt
              ? new Date(verificationTokenExpiresAt)
              : null,
            isDemo: false,
            isActive: true,
          })
          .returning();
        return sanitizePublicUser(rows[0]);
      } catch (error) {
        wrapDbError('create password user', error);
      }
    },

    async setPasswordByUid(uid, passwordHash) {
      try {
        const rows = await db
          .update(users)
          .set({ passwordHash, authProvider: 'google+password' })
          .where(eq(users.uid, uid))
          .returning();
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('set user password', error);
      }
    },

    async markEmailVerified(id) {
      try {
        const rows = await db
          .update(users)
          .set({
            emailVerified: true,
            verificationTokenHash: null,
            verificationTokenExpiresAt: null,
          })
          .where(eq(users.id, id))
          .returning();
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('mark email verified', error);
      }
    },

    async updateVerificationToken(id, { verificationTokenHash, verificationTokenExpiresAt }) {
      try {
        const rows = await db
          .update(users)
          .set({
            verificationTokenHash,
            verificationTokenExpiresAt: verificationTokenExpiresAt
              ? new Date(verificationTokenExpiresAt)
              : null,
          })
          .where(eq(users.id, id))
          .returning();
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('update verification token', error);
      }
    },

    async upsertVerifiedUser({ uid, email, fullName, role, department }) {
      try {
        const normalizedEmail = String(email).trim().toLowerCase();
        const rows = await db
          .insert(users)
          .values({
            uid,
            email: normalizedEmail,
            fullName,
            role,
            department: department || 'College of Informatics and Computing Sciences (CICS)',
            authProvider: 'google',
            emailVerified: true,
            isDemo: false,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              email: normalizedEmail,
              fullName,
              emailVerified: true,
            },
          })
          .returning();
        return sanitizePublicUser(rows[0]);
      } catch (error) {
        wrapDbError('upsert user', error);
      }
    },

    async updateProfile(id, { fullName, department, academicBlock }) {
      try {
        const updateSet = { fullName, department };
        if (academicBlock !== undefined) {
          updateSet.academicBlock = academicBlock;
        }
        const rows = await db
          .update(users)
          .set(updateSet)
          .where(eq(users.id, id))
          .returning();
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('update profile', error);
      }
    },

    async updateUserAccount(id, { role, isActive, department, academicBlock }) {
      try {
        const updateSet = { role, isActive, department };
        if (academicBlock !== undefined) {
          updateSet.academicBlock = academicBlock;
        }
        const rows = await db
          .update(users)
          .set(updateSet)
          .where(eq(users.id, id))
          .returning();
        return sanitizePublicUser(rows[0] || null);
      } catch (error) {
        wrapDbError('update user account', error);
      }
    },
  };

  const notificationPort = {
    async listByUserId(userId) {
      try {
        return await db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .orderBy(desc(notifications.createdAt));
      } catch (error) {
        wrapDbError('list notifications', error);
      }
    },

    async create({ userId, title, message, type, linkPath }) {
      try {
        const rows = await db
          .insert(notifications)
          .values({
            userId,
            title,
            message,
            type: type || 'info',
            linkPath: linkPath || null,
            isRead: false,
          })
          .returning();
        return rows[0];
      } catch (error) {
        wrapDbError('create notification', error);
      }
    },

    async markAsRead(userId, id) {
      try {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
      } catch (error) {
        wrapDbError('mark notification read', error);
      }
    },

    async markAllAsRead(userId) {
      try {
        await db
          .update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.userId, userId));
      } catch (error) {
        wrapDbError('mark all notifications read', error);
      }
    },
  };

  const auditLogPort = {
    async record({ actorUserId, actorEmail, actorRole, action, entityType, entityId, details }) {
      try {
        await db.insert(auditLogs).values({
          actorUserId: actorUserId || null,
          actorEmail,
          actorRole,
          action,
          entityType,
          entityId,
          details,
        });
      } catch (error) {
        console.error('[AuditLog Error] Failed to record audit entry:', error);
      }
    },

    async listRecent(limitCount = 30) {
      try {
        return await db
          .select()
          .from(auditLogs)
          .orderBy(desc(auditLogs.createdAt))
          .limit(limitCount);
      } catch (error) {
        wrapDbError('list audit logs', error);
      }
    },
  };

  async function enrichClassSchedules(rows) {
    if (!rows.length) return [];
    const [allFacilities, allUsers] = await Promise.all([
      db.select().from(facilities),
      db.select().from(users),
    ]);
    const facilityMap = new Map(allFacilities.map((f) => [f.id, f]));
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return rows.map((row) => {
      const f = row.facilityId ? facilityMap.get(row.facilityId) : null;
      const creator = row.createdBy ? userMap.get(row.createdBy) : null;
      const verifier = row.verifiedBy ? userMap.get(row.verifiedBy) : null;
      return {
        ...row,
        facilityId: row.facilityId ?? null,
        facilityCode: f?.code || null,
        facilityName: f?.name || 'Unspecified',
        facilityBuilding: f?.building || null,
        facilityFloor: f?.floor || null,
        facilityCategory: f?.category || null,
        facilityStatus: f?.status || null,
        facilityIsArchived: Boolean(f?.isArchived),
        verificationLabel: formatVerificationStatusLabel(row.verificationStatus),
        createdByName: creator?.fullName || null,
        verifiedByName: verifier?.fullName || null,
      };
    });
  }

  const classScheduleRepo = {
    async listAll() {
      try {
        const rows = await db.select().from(classSchedules);
        const enriched = await enrichClassSchedules(rows);
        return sortClassSchedules(enriched);
      } catch (error) {
        wrapDbError('list class schedules', error);
      }
    },

    async listByDayOfWeek(dayOfWeek) {
      try {
        const rows = await db
          .select()
          .from(classSchedules)
          .where(eq(classSchedules.dayOfWeek, dayOfWeek))
          .orderBy(asc(classSchedules.startTime));
        const enriched = await enrichClassSchedules(rows);
        return sortClassSchedules(enriched);
      } catch (error) {
        wrapDbError('list class schedules by weekday', error);
      }
    },

    async listByFacilityAndDay(facilityId, dayOfWeek) {
      try {
        const rows = await db
          .select()
          .from(classSchedules)
          .where(
            and(
              eq(classSchedules.facilityId, Number(facilityId)),
              eq(classSchedules.dayOfWeek, dayOfWeek)
            )
          )
          .orderBy(asc(classSchedules.startTime));
        const enriched = await enrichClassSchedules(rows);
        return sortClassSchedules(enriched);
      } catch (error) {
        wrapDbError('list class schedules by facility and day', error);
      }
    },

    async findById(id) {
      try {
        const rows = await db
          .select()
          .from(classSchedules)
          .where(eq(classSchedules.id, Number(id)));
        const enriched = await enrichClassSchedules(rows);
        return enriched[0] || null;
      } catch (error) {
        wrapDbError('find class schedule by id', error);
      }
    },

    async findBySeedKey(seedKey) {
      try {
        const rows = await db
          .select()
          .from(classSchedules)
          .where(eq(classSchedules.seedKey, String(seedKey)));
        const enriched = await enrichClassSchedules(rows);
        return enriched[0] || null;
      } catch (error) {
        wrapDbError('find class schedule by seedKey', error);
      }
    },

    async createWithConflictCheck(data) {
      try {
        const created = await db.transaction(async (tx) => {
          const sameDayRows = await tx
            .select()
            .from(classSchedules)
            .where(eq(classSchedules.dayOfWeek, data.dayOfWeek));
          const allFacilities = await tx.select().from(facilities);
          const facilityMap = new Map(allFacilities.map((f) => [f.id, f]));
          const sameDayEnriched = sameDayRows.map((row) => ({
            ...row,
            facilityName: row.facilityId ? facilityMap.get(row.facilityId)?.name : 'Unspecified',
            facilityCode: row.facilityId ? facilityMap.get(row.facilityId)?.code : null,
          }));

          assertNoClassScheduleConflicts(data, sameDayEnriched);

          const inserted = await tx
            .insert(classSchedules)
            .values({
              section: data.section,
              dayOfWeek: data.dayOfWeek,
              startTime: data.startTime,
              endTime: data.endTime,
              subjectCode: data.subjectCode,
              facilityId: data.facilityId ?? null,
              verificationStatus: data.verificationStatus,
              source: data.source,
              seedKey: data.seedKey ?? null,
              verifiedBy: data.verifiedBy ?? null,
              verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
              createdBy: data.createdBy ?? null,
            })
            .returning();
          return inserted[0];
        });

        const enriched = await enrichClassSchedules([created]);
        return enriched[0];
      } catch (error) {
        wrapDbError('create class schedule', error);
      }
    },

    async updateWithConflictCheck(id, data) {
      try {
        const numericId = Number(id);
        const updated = await db.transaction(async (tx) => {
          const sameDayRows = await tx
            .select()
            .from(classSchedules)
            .where(eq(classSchedules.dayOfWeek, data.dayOfWeek));
          const allFacilities = await tx.select().from(facilities);
          const facilityMap = new Map(allFacilities.map((f) => [f.id, f]));
          const sameDayEnriched = sameDayRows.map((row) => ({
            ...row,
            facilityName: row.facilityId ? facilityMap.get(row.facilityId)?.name : 'Unspecified',
            facilityCode: row.facilityId ? facilityMap.get(row.facilityId)?.code : null,
          }));

          assertNoClassScheduleConflicts(data, sameDayEnriched, { ignoreId: numericId });

          const updatePayload = {
            section: data.section,
            dayOfWeek: data.dayOfWeek,
            startTime: data.startTime,
            endTime: data.endTime,
            subjectCode: data.subjectCode,
            facilityId: data.facilityId ?? null,
            verificationStatus: data.verificationStatus,
            verifiedBy: data.verifiedBy ?? null,
            verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
            updatedAt: new Date(),
          };
          const rows = await tx
            .update(classSchedules)
            .set(updatePayload)
            .where(eq(classSchedules.id, numericId))
            .returning();
          return rows[0] || null;
        });

        if (!updated) return null;
        const enriched = await enrichClassSchedules([updated]);
        return enriched[0];
      } catch (error) {
        wrapDbError('update class schedule', error);
      }
    },

    async updateVerificationStatus(id, { verificationStatus, verifiedBy, verifiedAt }) {
      try {
        const rows = await db
          .update(classSchedules)
          .set({
            verificationStatus,
            verifiedBy: verifiedBy ?? null,
            verifiedAt: verifiedAt ? new Date(verifiedAt) : null,
            updatedAt: new Date(),
          })
          .where(eq(classSchedules.id, Number(id)))
          .returning();
        const enriched = await enrichClassSchedules(rows);
        return enriched[0] || null;
      } catch (error) {
        wrapDbError('update class schedule verification status', error);
      }
    },

    async remove(id) {
      try {
        const rows = await db
          .delete(classSchedules)
          .where(eq(classSchedules.id, Number(id)))
          .returning();
        return rows.length > 0;
      } catch (error) {
        wrapDbError('delete class schedule', error);
      }
    },
  };

  return {
    facilityRepo,
    reservationRepo,
    issueRepo,
    userRepo,
    notificationPort,
    auditLogPort,
    classScheduleRepo,
  };
}
