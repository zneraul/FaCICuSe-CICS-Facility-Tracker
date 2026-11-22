import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('student'),
  department: text('department'),
  academicBlock: text('academic_block'),
  authProvider: text('auth_provider').notNull().default('google'),
  emailVerified: boolean('email_verified').notNull().default(true),
  passwordHash: text('password_hash'),
  verificationTokenHash: text('verification_token_hash'),
  verificationTokenExpiresAt: timestamp('verification_token_expires_at'),
  isDemo: boolean('is_demo').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const facilities = pgTable('facilities', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  building: text('building').notNull(),
  floor: text('floor').notNull(),
  capacity: integer('capacity'),
  description: text('description').notNull(),
  amenities: text('amenities').notNull(),
  status: text('status').notNull().default('Available'),
  allowedRoles: text('allowed_roles').notNull().default('student,professor,admin'),
  openHour: text('open_hour').notNull().default('07:00'),
  closeHour: text('close_hour').notNull().default('21:00'),
  imageUrl: text('image_url').notNull(),
  isReservable: boolean('is_reservable').notNull().default(true),
  isArchived: boolean('is_archived').notNull().default(false),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reservations = pgTable('reservations', {
  id: serial('id').primaryKey(),
  facilityId: integer('facility_id')
    .references(() => facilities.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  reservationDate: text('reservation_date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  purpose: text('purpose').notNull(),
  academicBlock: text('academic_block'),
  attendeesCount: integer('attendees_count').notNull().default(1),
  status: text('status').notNull().default('Pending'),
  reviewerId: integer('reviewer_id').references(() => users.id),
  reviewNote: text('review_note'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const classSchedules = pgTable(
  'class_schedules',
  {
    id: serial('id').primaryKey(),
    section: text('section').notNull(),
    dayOfWeek: text('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    subjectCode: text('subject_code').notNull(),
    facilityId: integer('facility_id').references(() => facilities.id, {
      onDelete: 'set null',
    }),
    verificationStatus: text('verification_status')
      .notNull()
      .default('SUPPLIED_UNVERIFIED'),
    source: text('source').notNull().default('ADMIN_MANUAL'),
    seedKey: text('seed_key').unique(),
    verifiedBy: integer('verified_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    verifiedAt: timestamp('verified_at'),
    createdBy: integer('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_class_schedules_day_start').on(table.dayOfWeek, table.startTime),
    index('idx_class_schedules_facility_day').on(table.facilityId, table.dayOfWeek),
    index('idx_class_schedules_section_day').on(table.section, table.dayOfWeek),
    index('idx_class_schedules_verification').on(table.verificationStatus),
  ]
);

export const maintenanceIssues = pgTable('maintenance_issues', {
  id: serial('id').primaryKey(),
  facilityId: integer('facility_id')
    .references(() => facilities.id, { onDelete: 'cascade' })
    .notNull(),
  reporterId: integer('reporter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  category: text('category').notNull(),
  priority: text('priority').notNull().default('Medium'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  imageDataUrl: text('image_data_url'),
  status: text('status').notNull().default('Open'),
  actionTaken: text('action_taken'),
  assignedTo: text('assigned_to'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'),
  linkPath: text('link_path'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  reservations: many(reservations),
  maintenanceIssues: many(maintenanceIssues),
  notifications: many(notifications),
  createdClassSchedules: many(classSchedules),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  reservations: many(reservations),
  maintenanceIssues: many(maintenanceIssues),
  classSchedules: many(classSchedules),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  facility: one(facilities, {
    fields: [reservations.facilityId],
    references: [facilities.id],
  }),
  user: one(users, {
    fields: [reservations.userId],
    references: [users.id],
  }),
}));

export const classSchedulesRelations = relations(classSchedules, ({ one }) => ({
  facility: one(facilities, {
    fields: [classSchedules.facilityId],
    references: [facilities.id],
  }),
  creator: one(users, {
    fields: [classSchedules.createdBy],
    references: [users.id],
  }),
}));

export const maintenanceIssuesRelations = relations(maintenanceIssues, ({ one }) => ({
  facility: one(facilities, {
    fields: [maintenanceIssues.facilityId],
    references: [facilities.id],
  }),
  reporter: one(users, {
    fields: [maintenanceIssues.reporterId],
    references: [users.id],
  }),
}));
