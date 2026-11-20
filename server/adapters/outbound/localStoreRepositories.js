import fs from 'node:fs';
import path from 'node:path';
import { ACTIVE_BLOCKING_STATUSES } from '../../domain/entities.js';
import { ConflictError } from '../../domain/errors.js';
import { CICS_FACILITY_CATALOG, CICS_FACILITY_RENAMED_CODES } from '../../domain/projectInfo.js';
import { TimeSlot } from '../../domain/valueObjects.js';
import {
  ClassScheduleSource,
  ClassScheduleVerificationStatus,
  INITIAL_IT3106_CLASS_SCHEDULES,
  assertNoClassScheduleConflicts,
  assertNoReservationClassScheduleConflict,
  formatVerificationStatusLabel,
  getManilaWeekday,
  resolveCanonicalFacilityForSeed,
  sortClassSchedules,
} from '../../domain/classSchedule.js';

const DEFAULT_STORE_FILE = path.resolve(process.cwd(), '.facicuse-runtime-db.json');

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

function syncInitialClassSchedulesInState(targetState) {
  if (!Array.isArray(targetState.classSchedules)) {
    targetState.classSchedules = [];
  }
  if (!targetState.counters) {
    targetState.counters = {};
  }
  if (typeof targetState.counters.classSchedules !== 'number') {
    targetState.counters.classSchedules = targetState.classSchedules.reduce(
      (max, item) => Math.max(max, Number(item.id) || 0),
      0
    );
  }

  let changed = false;

  // Remove only erroneous Tuesday/Friday entries inserted strictly by an earlier initial dataset seed
  const beforeLen = targetState.classSchedules.length;
  targetState.classSchedules = targetState.classSchedules.filter((row) => {
    const isInitialSeed = row.source === ClassScheduleSource.SUPPLIED_INITIAL_DATASET;
    const isDisallowedInitialDay = row.dayOfWeek === 'Tuesday' || row.dayOfWeek === 'Friday';
    return !(isInitialSeed && isDisallowedInitialDay);
  });
  if (targetState.classSchedules.length !== beforeLen) {
    changed = true;
  }

  const existingSeedKeys = new Set(
    targetState.classSchedules.map((row) => row.seedKey).filter(Boolean)
  );
  const now = new Date().toISOString();

  for (const entry of INITIAL_IT3106_CLASS_SCHEDULES) {
    if (existingSeedKeys.has(entry.seedKey)) continue;
    const matchedFacility = resolveCanonicalFacilityForSeed(entry, targetState.facilities);
    targetState.counters.classSchedules += 1;
    targetState.classSchedules.push({
      id: targetState.counters.classSchedules,
      section: entry.section,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      subjectCode: entry.subjectCode,
      facilityId: matchedFacility ? matchedFacility.id : null,
      verificationStatus: ClassScheduleVerificationStatus.SUPPLIED_UNVERIFIED,
      source: ClassScheduleSource.SUPPLIED_INITIAL_DATASET,
      seedKey: entry.seedKey,
      verifiedBy: null,
      verifiedAt: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  }

  return changed;
}

function buildInitialState() {
  const now = new Date().toISOString();
  const facilities = CICS_FACILITY_CATALOG.map((room, index) => ({
    id: index + 1,
    code: room.code,
    name: room.name,
    category: room.category,
    building: room.building,
    floor: room.floor,
    capacity: room.capacity ?? null,
    description: room.description,
    amenities: room.amenities || '[]',
    status: room.status,
    allowedRoles: room.allowedRoles,
    openHour: room.openHour,
    closeHour: room.closeHour,
    imageUrl: room.imageUrl,
    isReservable: room.isReservable !== false,
    isArchived: false,
    isDemo: false,
    createdAt: now,
  }));

  const state = {
    counters: {
      users: 0,
      facilities: facilities.length,
      reservations: 0,
      classSchedules: 0,
      maintenanceIssues: 0,
      notifications: 0,
      auditLogs: 0,
    },
    users: [],
    facilities,
    reservations: [],
    classSchedules: [],
    maintenanceIssues: [],
    notifications: [],
    auditLogs: [],
  };

  syncInitialClassSchedulesInState(state);
  return state;
}

export function createLocalStoreAdapters({ storeFilePath = DEFAULT_STORE_FILE } = {}) {
  let state = loadState();

  function loadState() {
    try {
      if (fs.existsSync(storeFilePath)) {
        const raw = fs.readFileSync(storeFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.facilities) && Array.isArray(parsed.users)) {
          // Ensure canonical 38 CICS facilities are always present without inserting demo accounts
          const existingCodes = new Set(parsed.facilities.map((f) => f.code));
          const now = new Date().toISOString();
          let changed = false;
          for (const room of CICS_FACILITY_CATALOG) {
            if (existingCodes.has(room.code)) {
              if (CICS_FACILITY_RENAMED_CODES.includes(room.code)) {
                const existing = parsed.facilities.find((facility) => facility.code === room.code);
                if (existing && existing.name !== room.name) {
                  existing.name = room.name;
                  changed = true;
                }
              }
            } else {
              parsed.counters.facilities = (parsed.counters.facilities || parsed.facilities.length) + 1;
              parsed.facilities.push({
                id: parsed.counters.facilities,
                code: room.code,
                name: room.name,
                category: room.category,
                building: room.building,
                floor: room.floor,
                capacity: room.capacity ?? null,
                description: room.description,
                amenities: room.amenities || '[]',
                status: room.status,
                allowedRoles: room.allowedRoles,
                openHour: room.openHour,
                closeHour: room.closeHour,
                imageUrl: room.imageUrl,
                isReservable: room.isReservable !== false,
                isArchived: false,
                isDemo: false,
                createdAt: now,
              });
              changed = true;
            }
          }
          if (syncInitialClassSchedulesInState(parsed)) {
            changed = true;
          }
          if (changed) {
            saveState(parsed);
          }
          return parsed;
        }
      }
    } catch (error) {
      console.error('[LocalStore] Could not read persisted state, reinitializing:', error);
    }

    const fresh = buildInitialState();
    saveState(fresh);
    return fresh;
  }

  function saveState(nextState = state) {
    try {
      const tmp = `${storeFilePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(nextState, null, 2), 'utf8');
      fs.renameSync(tmp, storeFilePath);
    } catch (error) {
      console.error('[LocalStore] Failed to persist state:', error);
    }
  }

  function nextId(key) {
    state.counters[key] = (state.counters[key] || 0) + 1;
    return state.counters[key];
  }

  function enrichReservation(r) {
    const f = state.facilities.find((item) => item.id === r.facilityId);
    const u = state.users.find((item) => item.id === r.userId);
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
      requesterName: u?.fullName || 'Unknown User',
      userEmail: u?.email || '',
      userRole: u?.role || '',
      userAcademicBlock: u?.academicBlock || null,
    };
  }

  function enrichIssue(issue) {
    const f = state.facilities.find((item) => item.id === issue.facilityId);
    const u = state.users.find((item) => item.id === issue.reporterId);
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
  }

  const facilityRepo = {
    async listAll() {
      return state.facilities
        .filter((f) => !f.isArchived && !f.isDemo)
        .sort((a, b) => a.id - b.id);
    },

    async findById(id) {
      return state.facilities.find((f) => f.id === Number(id)) || null;
    },

    async findByCode(code) {
      const normalized = String(code || '').trim().toUpperCase();
      return state.facilities.find((f) => f.code === normalized) || null;
    },

    async create(data) {
      const record = {
        ...data,
        id: nextId('facilities'),
        isArchived: Boolean(data.isArchived),
        isDemo: false,
        createdAt: new Date().toISOString(),
      };
      state.facilities.push(record);
      saveState();
      return record;
    },

    async update(id, data) {
      const idx = state.facilities.findIndex((f) => f.id === Number(id));
      if (idx === -1) return null;
      state.facilities[idx] = { ...state.facilities[idx], ...data };
      saveState();
      return state.facilities[idx];
    },

    async remove(id) {
      const idx = state.facilities.findIndex((f) => f.id === Number(id));
      if (idx === -1) return false;
      state.facilities[idx] = {
        ...state.facilities[idx],
        isArchived: true,
        isReservable: false,
        status: 'Restricted',
      };
      saveState();
      return true;
    },
  };

  const reservationRepo = {
    async listAll() {
      return state.reservations
        .filter((r) => !r.isDemo)
        .map(enrichReservation)
        .filter((r) => !r.facilityIsArchived)
        .sort((a, b) => {
          if (a.reservationDate !== b.reservationDate) {
            return b.reservationDate.localeCompare(a.reservationDate);
          }
          return a.startTime.localeCompare(b.startTime);
        });
    },

    async listByUserId(userId) {
      return state.reservations
        .filter((r) => r.userId === Number(userId) && !r.isDemo)
        .map(enrichReservation)
        .filter((r) => !r.facilityIsArchived)
        .sort((a, b) => {
          if (a.reservationDate !== b.reservationDate) {
            return b.reservationDate.localeCompare(a.reservationDate);
          }
          return a.startTime.localeCompare(b.startTime);
        });
    },

    async listByFacilityAndDate(facilityId, reservationDate) {
      return state.reservations
        .filter(
          (r) =>
            !r.isDemo &&
            r.facilityId === Number(facilityId) &&
            r.reservationDate === reservationDate
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    },

    async findById(id) {
      const row = state.reservations.find((r) => r.id === Number(id));
      return row ? enrichReservation(row) : null;
    },

    async createWithConflictCheck(data) {
      const sameDay = state.reservations.filter(
        (item) =>
          item.facilityId === Number(data.facilityId) &&
          item.reservationDate === data.reservationDate &&
          ACTIVE_BLOCKING_STATUSES.includes(item.status)
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
      const facility = state.facilities.find((f) => f.id === Number(data.facilityId));
      const sameDayClasses = (state.classSchedules || []).filter(
        (c) => c.facilityId === Number(data.facilityId) && c.dayOfWeek === weekday
      );
      if (sameDayClasses.length > 0) {
        assertNoReservationClassScheduleConflict({
          facility: facility || { id: Number(data.facilityId) },
          reservationDate: data.reservationDate,
          startTime: data.startTime,
          endTime: data.endTime,
          classSchedules: sameDayClasses,
        });
      }

      const now = new Date().toISOString();
      const created = {
        ...data,
        id: nextId('reservations'),
        reviewerId: data.reviewerId ?? null,
        reviewNote: data.reviewNote ?? null,
        createdAt: now,
        updatedAt: now,
      };
      state.reservations.push(created);
      saveState();
      return enrichReservation(created);
    },

    async updateStatus(id, { status, reviewerId, reviewNote }) {
      const idx = state.reservations.findIndex((r) => r.id === Number(id));
      if (idx === -1) return null;
      state.reservations[idx] = {
        ...state.reservations[idx],
        status,
        reviewerId: reviewerId ?? state.reservations[idx].reviewerId ?? null,
        reviewNote: reviewNote ?? null,
        updatedAt: new Date().toISOString(),
      };
      saveState();
      return enrichReservation(state.reservations[idx]);
    },

    async rescheduleWithConflictCheck(
      id,
      { facilityId, reservationDate, startTime, endTime, reviewerId, reviewNote }
    ) {
      const numericId = Number(id);
      const idx = state.reservations.findIndex((r) => r.id === numericId);
      if (idx === -1) return null;

      const sameDay = state.reservations.filter(
        (item) =>
          item.id !== numericId &&
          item.facilityId === Number(facilityId) &&
          item.reservationDate === reservationDate &&
          ACTIVE_BLOCKING_STATUSES.includes(item.status)
      );
      const requestedSlot = new TimeSlot(reservationDate, startTime, endTime);
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

      const weekday = getManilaWeekday(reservationDate);
      const facility = state.facilities.find((f) => f.id === Number(facilityId));
      const sameDayClasses = (state.classSchedules || []).filter(
        (c) => c.facilityId === Number(facilityId) && c.dayOfWeek === weekday
      );
      if (sameDayClasses.length > 0) {
        assertNoReservationClassScheduleConflict({
          facility: facility || { id: Number(facilityId) },
          reservationDate,
          startTime,
          endTime,
          classSchedules: sameDayClasses,
        });
      }

      state.reservations[idx] = {
        ...state.reservations[idx],
        facilityId: Number(facilityId),
        reservationDate,
        startTime,
        endTime,
        reviewerId: reviewerId ?? null,
        reviewNote: reviewNote ?? null,
        updatedAt: new Date().toISOString(),
      };
      saveState();
      return enrichReservation(state.reservations[idx]);
    },
  };

  const issueRepo = {
    async listAll() {
      return state.maintenanceIssues
        .filter((i) => !i.isDemo)
        .map(enrichIssue)
        .filter((i) => !i.facilityIsArchived)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },

    async listByReporterId(reporterId) {
      return state.maintenanceIssues
        .filter((i) => i.reporterId === Number(reporterId) && !i.isDemo)
        .map(enrichIssue)
        .filter((i) => !i.facilityIsArchived)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },

    async findById(id) {
      const row = state.maintenanceIssues.find((i) => i.id === Number(id));
      return row ? enrichIssue(row) : null;
    },

    async create(data) {
      const now = new Date().toISOString();
      const created = {
        ...data,
        id: nextId('maintenanceIssues'),
        actionTaken: null,
        assignedTo: null,
        createdAt: now,
        updatedAt: now,
      };
      state.maintenanceIssues.push(created);
      saveState();
      return enrichIssue(created);
    },

    async updateStatus(id, { status, actionTaken, assignedTo }) {
      const idx = state.maintenanceIssues.findIndex((i) => i.id === Number(id));
      if (idx === -1) return null;
      state.maintenanceIssues[idx] = {
        ...state.maintenanceIssues[idx],
        status,
        actionTaken: actionTaken ?? null,
        assignedTo: assignedTo ?? null,
        updatedAt: new Date().toISOString(),
      };
      saveState();
      return enrichIssue(state.maintenanceIssues[idx]);
    },
  };

  const userRepo = {
    async listAll() {
      return state.users
        .filter((u) => !u.isDemo)
        .sort((a, b) => a.role.localeCompare(b.role) || a.fullName.localeCompare(b.fullName))
        .map(sanitizePublicUser);
    },

    async findByUid(uid) {
      const user = state.users.find((u) => u.uid === uid);
      return sanitizePublicUser(user);
    },

    async findByEmail(email) {
      const normalized = String(email || '').trim().toLowerCase();
      const user = state.users.find((u) => u.email === normalized);
      return sanitizePublicUser(user);
    },

    async findAuthRecordByEmail(email) {
      const normalized = String(email || '').trim().toLowerCase();
      const user = state.users.find((u) => u.email === normalized);
      return user ? { ...user } : null;
    },

    async findById(id) {
      const user = state.users.find((u) => u.id === Number(id));
      return sanitizePublicUser(user);
    },

    async findByVerificationTokenHash(tokenHash) {
      const user = state.users.find((u) => u.verificationTokenHash === tokenHash);
      return user ? { ...user } : null;
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
      const normalizedEmail = String(email).trim().toLowerCase();
      if (state.users.some((u) => u.email === normalizedEmail)) {
        throw new ConflictError('An account with this university email already exists.');
      }
      const created = {
        id: nextId('users'),
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
        verificationTokenExpiresAt,
        isDemo: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      state.users.push(created);
      saveState();
      return sanitizePublicUser(created);
    },

    async setPasswordByUid(uid, passwordHash) {
      const idx = state.users.findIndex((u) => u.uid === uid);
      if (idx === -1) return null;
      state.users[idx] = {
        ...state.users[idx],
        passwordHash,
        authProvider: 'google+password',
      };
      saveState();
      return sanitizePublicUser(state.users[idx]);
    },

    async markEmailVerified(id) {
      const idx = state.users.findIndex((u) => u.id === Number(id));
      if (idx === -1) return null;
      state.users[idx] = {
        ...state.users[idx],
        emailVerified: true,
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
      };
      saveState();
      return sanitizePublicUser(state.users[idx]);
    },

    async updateVerificationToken(id, { verificationTokenHash, verificationTokenExpiresAt }) {
      const idx = state.users.findIndex((u) => u.id === Number(id));
      if (idx === -1) return null;
      state.users[idx] = {
        ...state.users[idx],
        verificationTokenHash,
        verificationTokenExpiresAt,
      };
      saveState();
      return sanitizePublicUser(state.users[idx]);
    },

    async upsertVerifiedUser({ uid, email, fullName, role, department }) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const idx = state.users.findIndex((u) => u.uid === uid || u.email === normalizedEmail);
      if (idx !== -1) {
        state.users[idx] = {
          ...state.users[idx],
          uid,
          email: normalizedEmail,
          fullName,
          emailVerified: true,
        };
        saveState();
        return sanitizePublicUser(state.users[idx]);
      }

      const created = {
        id: nextId('users'),
        uid,
        email: normalizedEmail,
        fullName,
        role,
        department: department || 'College of Informatics and Computing Sciences (CICS)',
        academicBlock: null,
        authProvider: 'google',
        emailVerified: true,
        passwordHash: null,
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
        isDemo: false,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      state.users.push(created);
      saveState();
      return sanitizePublicUser(created);
    },

    async updateProfile(id, { fullName, department, academicBlock }) {
      const idx = state.users.findIndex((u) => u.id === Number(id));
      if (idx === -1) return null;
      const patch = { fullName, department };
      if (academicBlock !== undefined) {
        patch.academicBlock = academicBlock;
      }
      state.users[idx] = { ...state.users[idx], ...patch };
      saveState();
      return sanitizePublicUser(state.users[idx]);
    },

    async updateUserAccount(id, { role, isActive, department, academicBlock }) {
      const idx = state.users.findIndex((u) => u.id === Number(id));
      if (idx === -1) return null;
      const patch = { role, isActive, department };
      if (academicBlock !== undefined) {
        patch.academicBlock = academicBlock;
      }
      state.users[idx] = { ...state.users[idx], ...patch };
      saveState();
      return sanitizePublicUser(state.users[idx]);
    },
  };

  const notificationPort = {
    async listByUserId(userId) {
      return state.notifications
        .filter((n) => n.userId === Number(userId))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },

    async create({ userId, title, message, type, linkPath }) {
      const created = {
        id: nextId('notifications'),
        userId: Number(userId),
        title,
        message,
        type: type || 'info',
        linkPath: linkPath || null,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      state.notifications.push(created);
      saveState();
      return created;
    },

    async markAsRead(userId, id) {
      const item = state.notifications.find(
        (n) => n.id === Number(id) && n.userId === Number(userId)
      );
      if (item) {
        item.isRead = true;
        saveState();
      }
    },

    async markAllAsRead(userId) {
      let changed = false;
      for (const n of state.notifications) {
        if (n.userId === Number(userId) && !n.isRead) {
          n.isRead = true;
          changed = true;
        }
      }
      if (changed) saveState();
    },
  };

  const auditLogPort = {
    async record({ actorUserId, actorEmail, actorRole, action, entityType, entityId, details }) {
      const entry = {
        id: nextId('auditLogs'),
        actorUserId: actorUserId || null,
        actorEmail,
        actorRole,
        action,
        entityType,
        entityId,
        details,
        createdAt: new Date().toISOString(),
      };
      state.auditLogs.push(entry);
      if (state.auditLogs.length > 500) {
        state.auditLogs = state.auditLogs.slice(-500);
      }
      saveState();
    },

    async listRecent(limitCount = 30) {
      return [...state.auditLogs]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limitCount);
    },
  };

  function enrichClassSchedule(row) {
    const f = row.facilityId
      ? state.facilities.find((item) => item.id === Number(row.facilityId))
      : null;
    const creator = row.createdBy
      ? state.users.find((item) => item.id === Number(row.createdBy))
      : null;
    const verifier = row.verifiedBy
      ? state.users.find((item) => item.id === Number(row.verifiedBy))
      : null;
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
  }

  const classScheduleRepo = {
    async listAll() {
      return sortClassSchedules((state.classSchedules || []).map(enrichClassSchedule));
    },

    async listByDayOfWeek(dayOfWeek) {
      return sortClassSchedules(
        (state.classSchedules || [])
          .filter((row) => row.dayOfWeek === dayOfWeek)
          .map(enrichClassSchedule)
      );
    },

    async listByFacilityAndDay(facilityId, dayOfWeek) {
      return sortClassSchedules(
        (state.classSchedules || [])
          .filter(
            (row) =>
              row.facilityId !== null &&
              Number(row.facilityId) === Number(facilityId) &&
              row.dayOfWeek === dayOfWeek
          )
          .map(enrichClassSchedule)
      );
    },

    async findById(id) {
      const row = (state.classSchedules || []).find((item) => item.id === Number(id));
      return row ? enrichClassSchedule(row) : null;
    },

    async findBySeedKey(seedKey) {
      const row = (state.classSchedules || []).find((item) => item.seedKey === String(seedKey));
      return row ? enrichClassSchedule(row) : null;
    },

    async createWithConflictCheck(data) {
      const sameDayEnriched = (state.classSchedules || [])
        .filter((row) => row.dayOfWeek === data.dayOfWeek)
        .map(enrichClassSchedule);
      assertNoClassScheduleConflicts(data, sameDayEnriched);

      const now = new Date().toISOString();
      const created = {
        id: nextId('classSchedules'),
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
        verifiedAt: data.verifiedAt || null,
        createdBy: data.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
      };
      state.classSchedules.push(created);
      saveState();
      return enrichClassSchedule(created);
    },

    async updateWithConflictCheck(id, data) {
      const numericId = Number(id);
      const idx = (state.classSchedules || []).findIndex((item) => item.id === numericId);
      if (idx === -1) return null;

      const sameDayEnriched = (state.classSchedules || [])
        .filter((row) => row.dayOfWeek === data.dayOfWeek)
        .map(enrichClassSchedule);
      assertNoClassScheduleConflicts(data, sameDayEnriched, { ignoreId: numericId });

      state.classSchedules[idx] = {
        ...state.classSchedules[idx],
        section: data.section,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        subjectCode: data.subjectCode,
        facilityId: data.facilityId ?? null,
        verificationStatus: data.verificationStatus,
        verifiedBy: data.verifiedBy ?? null,
        verifiedAt: data.verifiedAt || null,
        updatedAt: new Date().toISOString(),
      };
      saveState();
      return enrichClassSchedule(state.classSchedules[idx]);
    },

    async updateVerificationStatus(id, { verificationStatus, verifiedBy, verifiedAt }) {
      const idx = (state.classSchedules || []).findIndex((item) => item.id === Number(id));
      if (idx === -1) return null;
      state.classSchedules[idx] = {
        ...state.classSchedules[idx],
        verificationStatus,
        verifiedBy: verifiedBy ?? null,
        verifiedAt: verifiedAt || null,
        updatedAt: new Date().toISOString(),
      };
      saveState();
      return enrichClassSchedule(state.classSchedules[idx]);
    },

    async remove(id) {
      const idx = (state.classSchedules || []).findIndex((item) => item.id === Number(id));
      if (idx === -1) return false;
      state.classSchedules.splice(idx, 1);
      saveState();
      return true;
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
