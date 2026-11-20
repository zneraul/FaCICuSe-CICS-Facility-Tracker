-- Migration 0002: Recurring Weekly Academic Class Schedules
-- Coexists alongside date-specific reservations and admin schedule blocks without modifying them.

CREATE TABLE IF NOT EXISTS "class_schedules" (
  "id" serial PRIMARY KEY NOT NULL,
  "section" text NOT NULL,
  "day_of_week" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "subject_code" text NOT NULL,
  "facility_id" integer REFERENCES "facilities"("id") ON DELETE SET NULL,
  "verification_status" text DEFAULT 'SUPPLIED_UNVERIFIED' NOT NULL,
  "source" text DEFAULT 'ADMIN_MANUAL' NOT NULL,
  "seed_key" text UNIQUE,
  "verified_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "verified_at" timestamp,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "chk_class_schedules_day_of_week" CHECK (
    "day_of_week" IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
  ),
  CONSTRAINT "chk_class_schedules_verification_status" CHECK (
    "verification_status" IN ('SUPPLIED_UNVERIFIED', 'ADMIN_VERIFIED')
  ),
  CONSTRAINT "chk_class_schedules_time_order" CHECK (
    "end_time" > "start_time"
  )
);

CREATE INDEX IF NOT EXISTS "idx_class_schedules_day_start"
  ON "class_schedules" ("day_of_week", "start_time");

CREATE INDEX IF NOT EXISTS "idx_class_schedules_facility_day"
  ON "class_schedules" ("facility_id", "day_of_week");

CREATE INDEX IF NOT EXISTS "idx_class_schedules_section_day"
  ON "class_schedules" ("section", "day_of_week");

CREATE INDEX IF NOT EXISTS "idx_class_schedules_verification"
  ON "class_schedules" ("verification_status");
