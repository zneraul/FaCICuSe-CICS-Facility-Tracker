import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../src/db/index.ts';
import { classSchedules, facilities } from '../../../src/db/schema.ts';
import {
  CICS_FACILITY_CATALOG,
  OBSOLETE_GENERIC_FACILITY_CODES,
  CICS_FACILITY_RENAMED_CODES,
} from '../../domain/projectInfo.js';
import {
  ClassScheduleSource,
  ClassScheduleVerificationStatus,
  INITIAL_IT3106_CLASS_SCHEDULES,
  resolveCanonicalFacilityForSeed,
} from '../../domain/classSchedule.js';
import { isPostgresConfigured } from '../../infrastructure/config.js';

let catalogSyncPromise = null;

/**
 * Idempotently populates the 5 approved IT-3106 recurring class schedule records in PostgreSQL.
 * - Never duplicates records on rerun (keyed by unique seed_key + onConflictDoNothing).
 * - Never overwrites administrator edits or verification status decisions.
 * - Removes only erroneous Tuesday/Friday entries inserted strictly by this initial dataset.
 * - Resolves facility IDs strictly against the canonical CICS facility catalog.
 */
export async function ensureInitialClassSchedules() {
  if (!isPostgresConfigured()) {
    return { inserted: 0, skipped: 0, unresolvedFacilities: [] };
  }

  return db.transaction(async (tx) => {
    // Clean up only erroneous Tuesday/Friday entries inserted by an earlier initial dataset seed
    await tx
      .delete(classSchedules)
      .where(
        and(
          eq(classSchedules.source, ClassScheduleSource.SUPPLIED_INITIAL_DATASET),
          inArray(classSchedules.dayOfWeek, ['Tuesday', 'Friday'])
        )
      );

    const allFacilities = await tx.select().from(facilities);
    const existingRows = await tx
      .select({ seedKey: classSchedules.seedKey })
      .from(classSchedules);
    const existingSeedKeys = new Set(existingRows.map((r) => r.seedKey).filter(Boolean));

    const toInsert = [];
    const unresolvedFacilities = [];
    let skipped = 0;

    for (const entry of INITIAL_IT3106_CLASS_SCHEDULES) {
      if (existingSeedKeys.has(entry.seedKey)) {
        skipped += 1;
        continue;
      }

      const matchedFacility = resolveCanonicalFacilityForSeed(entry, allFacilities);
      if (!matchedFacility) {
        unresolvedFacilities.push({
          seedKey: entry.seedKey,
          subjectCode: entry.subjectCode,
          requestedFacilityName: entry.requestedFacilityName,
        });
      }

      toInsert.push({
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
      });
    }

    if (toInsert.length > 0) {
      await tx.insert(classSchedules).values(toInsert).onConflictDoNothing();
    }

    return {
      inserted: toInsert.length,
      skipped,
      unresolvedFacilities,
    };
  });
}

/**
 * Synchronizes the canonical 38 CICS Building facility inventory and initial recurring
 * class schedule dataset in PostgreSQL without creating demo accounts or deleting/truncating
 * legitimate operational records.
 */
export async function ensureFacilityCatalog() {
  if (!isPostgresConfigured()) {
    return;
  }
  if (catalogSyncPromise) {
    return catalogSyncPromise;
  }

  catalogSyncPromise = (async () => {
    try {
      // 1. Safely archive obsolete generic facilities without deleting linked historical foreign-key records
      if (OBSOLETE_GENERIC_FACILITY_CODES.length > 0) {
        await db
          .update(facilities)
          .set({
            isArchived: true,
            isReservable: false,
            status: 'Restricted',
          })
          .where(inArray(facilities.code, [...OBSOLETE_GENERIC_FACILITY_CODES]));
      }

      // 2. Insert any missing canonical CICS Building facilities without fabricating capacities or operational metrics
      const existingRows = await db.select().from(facilities);
      const existingByCode = new Map(existingRows.map((row) => [row.code, row]));

      // Apply only the explicitly approved room-name corrections; preserve other admin-managed fields.
      for (const code of CICS_FACILITY_RENAMED_CODES) {
        const canonical = CICS_FACILITY_CATALOG.find((room) => room.code === code);
        const existing = existingByCode.get(code);
        if (canonical && existing && existing.name !== canonical.name) {
          await db.update(facilities).set({ name: canonical.name }).where(eq(facilities.code, code));
        }
      }

      const missingCicsFacilities = CICS_FACILITY_CATALOG.filter(
        (room) => !existingByCode.has(room.code)
      ).map((room) => ({
        code: room.code,
        name: room.name,
        category: room.category,
        building: room.building,
        floor: room.floor,
        capacity: room.capacity,
        description: room.description,
        amenities: room.amenities,
        status: room.status,
        allowedRoles: room.allowedRoles,
        openHour: room.openHour,
        closeHour: room.closeHour,
        imageUrl: room.imageUrl,
        isReservable: room.isReservable,
        isArchived: false,
        isDemo: false,
      }));

      if (missingCicsFacilities.length > 0) {
        await db.insert(facilities).values(missingCicsFacilities).onConflictDoNothing();
      }

      // 3. Idempotently populate the approved IT-3106 initial recurring class schedule dataset
      try {
        await ensureInitialClassSchedules();
      } catch (scheduleErr) {
        console.warn(
          '[Catalog Sync] Class schedule sync skipped (table may not be migrated yet):',
          scheduleErr?.message || scheduleErr
        );
      }
    } catch (error) {
      catalogSyncPromise = null;
      console.error('[Catalog Sync] CICS facility catalog synchronization failed:', error);
      throw error;
    }
  })();

  return catalogSyncPromise;
}

export function resetCatalogSyncCache() {
  catalogSyncPromise = null;
}
