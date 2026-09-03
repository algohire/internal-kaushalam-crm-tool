import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ──

// Using text instead of enum for role/team to avoid conflicts with Better Auth defaults

// ── Better Auth tables ──

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("caller"),
  team: text("team").notNull().default("rg"),
  active: boolean("active").notNull().default(true),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  issuer: text("issuer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Masters ──

export const qualificationMaster = pgTable("qualification_master", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

// ── Import bookkeeping ──

export const importBatch = pgTable("import_batch", {
  id: text("id").primaryKey(),
  sourceFile: text("source_file").notNull(),
  extractDate: text("extract_date"),
  importedAt: text("imported_at").notNull(),
  importedBy: text("imported_by"),
  rowCount: integer("row_count"),
  companyCount: integer("company_count"),
  requirementCount: integer("requirement_count"),
  notes: text("notes"),
});

// ── EDB raw snapshot (append-only) ──

export const edbRaw = pgTable(
  "edb_raw",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => importBatch.id),
    rowNo: integer("row_no").notNull(),
    referenceId: text("reference_id"),
    companyCode: text("company_code"),
    roleName: text("role_name"),
    rowJson: text("row_json").notNull(),
  },
  (table) => [index("ix_edb_raw_company").on(table.companyCode)]
);

// ── Company ──

export const company = pgTable(
  "company",
  {
    companyCode: text("company_code").primaryKey(),
    companyName: text("company_name").notNull(),
    legalName: text("legal_name"),
    gstin: text("gstin"),
    pan: text("pan"),
    udyamNumber: text("udyam_number"),
    sector: text("sector"),
    sectors: text("sectors"),
    subsectors: text("subsectors"),
    lineOfActivity: text("line_of_activity"),
    plantLocation: text("plant_location"),
    district: text("district"),
    mandal: text("mandal"),
    village: text("village"),
    stage: text("stage"),
    projectName: text("project_name"),
    presentHeadcount: integer("present_headcount"),
    totalRequired: integer("total_required"),
    companyRank: integer("company_rank"),
    tier: integer("tier"),
    flags: text("flags"),
    tags: text("tags"),
    bookmarkedBy: text("bookmarked_by"),
    lastDisposition: text("last_disposition"),
    lastContactAt: text("last_contact_at"),
    contactCount: integer("contact_count").notNull().default(0),
    firstSeenBatch: text("first_seen_batch").references(() => importBatch.id),
    lastSeenBatch: text("last_seen_batch").references(() => importBatch.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("ix_company_district").on(table.district),
    index("ix_company_rank").on(table.companyRank),
    index("ix_company_last_contact").on(table.lastContactAt),
  ]
);

// ── Contact ──

export const contact = pgTable(
  "contact",
  {
    id: text("id").primaryKey(),
    companyCode: text("company_code")
      .notNull()
      .references(() => company.companyCode),
    name: text("name"),
    designation: text("designation"),
    mobileRaw: text("mobile_raw"),
    mobile: text("mobile"),
    email: text("email"),
    pocFor: text("poc_for").default("requirement"),
    source: text("source").notNull(),
    referenceId: text("reference_id"),
    isPrimary: boolean("is_primary").notNull().default(false),
    valid: boolean("valid").notNull().default(true),
    createdAt: text("created_at").notNull(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("ix_contact_company").on(table.companyCode),
    index("ix_contact_mobile").on(table.mobile),
  ]
);

// ── Requirement ──

export const requirement = pgTable(
  "requirement",
  {
    id: text("id").primaryKey(),
    companyCode: text("company_code")
      .notNull()
      .references(() => company.companyCode),
    referenceId: text("reference_id").notNull(),
    edbRowId: text("edb_row_id").references(() => edbRaw.id),
    roleName: text("role_name").notNull(),
    isCustom: boolean("is_custom"),
    currentEmployment: integer("current_employment"),
    requiredCount: integer("required_count"),
    requiredWithinMonths: integer("required_within_months"),
    skills: text("skills"),
    createdAtEdb: text("created_at_edb"),
    roleNameEdited: text("role_name_edited"),
    standardRole: text("standard_role"),
    requiredCountValidated: integer("required_count_validated"),
    timing: text("timing"),
    timingDate: text("timing_date"),
    qualification: text("qualification"),
    experience: text("experience"),
    genderPreference: text("gender_preference"),
    ageLimit: text("age_limit"),
    salary: text("salary"),
    experienceFrom: integer("experience_from"),
    experienceTo: integer("experience_to"),
    pwd: boolean("pwd").default(false),
    needTraining: boolean("need_training").notNull().default(false),
    qpCode: text("qp_code"),
    classification: text("classification"),
    collectorDistrict: text("collector_district"),
    status: text("status").notNull().default("captured"),
    handoffComment: text("handoff_comment"),
    handedOverAt: text("handed_over_at"),
    handedOverBy: text("handed_over_by"),
    comment: text("comment"),
    flags: text("flags"),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    index("ix_req_company").on(table.companyCode),
    index("ix_req_status").on(table.status),
    uniqueIndex("ux_req_natural").on(
      table.referenceId,
      table.roleName,
      table.createdAtEdb
    ),
  ]
);

// ── Requirement version (append-only) ──

export const requirementVersion = pgTable(
  "requirement_version",
  {
    id: text("id").primaryKey(),
    requirementId: text("requirement_id")
      .notNull()
      .references(() => requirement.id),
    version: integer("version").notNull(),
    changedAt: text("changed_at").notNull(),
    changedBy: text("changed_by").notNull(),
    interactionId: text("interaction_id"),
    diffJson: text("diff_json").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
  },
  (table) => [index("ix_reqver_req").on(table.requirementId)]
);

// ── Interaction (append-only) ──

export const interaction = pgTable(
  "interaction",
  {
    id: text("id").primaryKey(),
    companyCode: text("company_code")
      .notNull()
      .references(() => company.companyCode),
    contactId: text("contact_id").references(() => contact.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    username: text("username").notNull(),
    team: text("team").notNull().default("rg"),
    channel: text("channel").notNull(),
    disposition: text("disposition").notNull(),
    reasonCode: text("reason_code"),
    comment: text("comment").notNull(),
    nextStep: text("next_step").notNull(),
    nextActionDate: text("next_action_date").notNull(),
    requirementIds: text("requirement_ids"),
    fieldsChangedJson: text("fields_changed_json"),
    source: text("source").notNull().default("app"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("ix_inter_company").on(table.companyCode),
    index("ix_inter_user").on(table.userId, table.createdAt),
  ]
);

// ── Task ──

export const task = pgTable(
  "task",
  {
    id: text("id").primaryKey(),
    companyCode: text("company_code")
      .notNull()
      .references(() => company.companyCode),
    requirementId: text("requirement_id").references(() => requirement.id),
    userId: text("user_id").references(() => user.id),
    title: text("title").notNull(),
    dueDate: text("due_date").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull().default("open"),
    createdByInteraction: text("created_by_interaction").references(
      () => interaction.id
    ),
    closedByInteraction: text("closed_by_interaction").references(
      () => interaction.id
    ),
    createdAt: text("created_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [index("ix_task_user_due").on(table.userId, table.status, table.dueDate)]
);

// ── EDB outbox (append-only) ──

export const edbOutbox = pgTable("edb_outbox", {
  id: text("id").primaryKey(),
  companyCode: text("company_code").notNull(),
  referenceId: text("reference_id"),
  requirementId: text("requirement_id"),
  version: integer("version"),
  deltaJson: text("delta_json").notNull(),
  category: text("category").notNull(),
  createdAt: text("created_at").notNull(),
  sentAt: text("sent_at"),
  ackId: text("ack_id"),
});

// ── Audit log (append-only) ──

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  username: text("username"),
  action: text("action").notNull(),
  objectType: text("object_type"),
  objectId: text("object_id"),
  detailJson: text("detail_json"),
  createdAt: text("created_at").notNull(),
});
