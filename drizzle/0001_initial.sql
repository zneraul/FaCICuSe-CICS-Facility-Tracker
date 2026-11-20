CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "uid" text NOT NULL UNIQUE,
  "email" text NOT NULL UNIQUE,
  "full_name" text NOT NULL,
  "role" text DEFAULT 'student' NOT NULL,
  "department" text,
  "is_demo" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "facilities" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "building" text NOT NULL,
  "floor" text NOT NULL,
  "capacity" integer NOT NULL,
  "description" text NOT NULL,
  "amenities" text NOT NULL,
  "status" text DEFAULT 'Available' NOT NULL,
  "allowed_roles" text DEFAULT 'student,professor,admin' NOT NULL,
  "open_hour" text DEFAULT '07:00' NOT NULL,
  "close_hour" text DEFAULT '21:00' NOT NULL,
  "image_url" text NOT NULL,
  "is_demo" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reservations" (
  "id" serial PRIMARY KEY NOT NULL,
  "facility_id" integer NOT NULL REFERENCES "facilities"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reservation_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "purpose" text NOT NULL,
  "attendees_count" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'Pending' NOT NULL,
  "reviewer_id" integer REFERENCES "users"("id"),
  "review_note" text,
  "is_demo" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "maintenance_issues" (
  "id" serial PRIMARY KEY NOT NULL,
  "facility_id" integer NOT NULL REFERENCES "facilities"("id") ON DELETE CASCADE,
  "reporter_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "priority" text DEFAULT 'Medium' NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "image_data_url" text,
  "status" text DEFAULT 'Open' NOT NULL,
  "action_taken" text,
  "assigned_to" text,
  "is_demo" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text DEFAULT 'info' NOT NULL,
  "link_path" text,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_user_id" integer REFERENCES "users"("id"),
  "actor_email" text NOT NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "details" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
