CREATE TYPE "public"."user_role" AS ENUM('caller', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_team" AS ENUM('rg', 'scheduling', 'outcomes', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"username" text,
	"action" text NOT NULL,
	"object_type" text,
	"object_id" text,
	"detail_json" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"company_code" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"legal_name" text,
	"gstin" text,
	"pan" text,
	"udyam_number" text,
	"sector" text,
	"sectors" text,
	"subsectors" text,
	"line_of_activity" text,
	"plant_location" text,
	"district" text,
	"mandal" text,
	"village" text,
	"stage" text,
	"project_name" text,
	"present_headcount" integer,
	"total_required" integer,
	"company_rank" integer,
	"tier" integer,
	"flags" text,
	"tags" text,
	"last_disposition" text,
	"last_contact_at" text,
	"contact_count" integer DEFAULT 0 NOT NULL,
	"first_seen_batch" text,
	"last_seen_batch" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"company_code" text NOT NULL,
	"name" text,
	"designation" text,
	"mobile_raw" text,
	"mobile" text,
	"email" text,
	"poc_for" text DEFAULT 'requirement',
	"source" text NOT NULL,
	"reference_id" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"valid" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "edb_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"company_code" text NOT NULL,
	"reference_id" text,
	"requirement_id" text,
	"version" integer,
	"delta_json" text NOT NULL,
	"category" text NOT NULL,
	"created_at" text NOT NULL,
	"sent_at" text,
	"ack_id" text
);
--> statement-breakpoint
CREATE TABLE "edb_raw" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"row_no" integer NOT NULL,
	"reference_id" text,
	"company_code" text,
	"role_name" text,
	"row_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"source_file" text NOT NULL,
	"extract_date" text,
	"imported_at" text NOT NULL,
	"imported_by" text,
	"row_count" integer,
	"company_count" integer,
	"requirement_count" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"id" text PRIMARY KEY NOT NULL,
	"company_code" text NOT NULL,
	"contact_id" text,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"team" text DEFAULT 'rg' NOT NULL,
	"channel" text NOT NULL,
	"disposition" text NOT NULL,
	"reason_code" text,
	"comment" text NOT NULL,
	"next_step" text NOT NULL,
	"next_action_date" text NOT NULL,
	"requirement_ids" text,
	"fields_changed_json" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement" (
	"id" text PRIMARY KEY NOT NULL,
	"company_code" text NOT NULL,
	"reference_id" text NOT NULL,
	"edb_row_id" text,
	"role_name" text NOT NULL,
	"is_custom" boolean,
	"current_employment" integer,
	"required_count" integer,
	"required_within_months" integer,
	"skills" text,
	"created_at_edb" text,
	"role_name_edited" text,
	"standard_role" text,
	"required_count_validated" integer,
	"timing" text,
	"timing_date" text,
	"qualification" text,
	"experience" text,
	"gender_preference" text,
	"age_limit" text,
	"salary" text,
	"shift" text,
	"monthly_intake" integer,
	"need_training" boolean DEFAULT false NOT NULL,
	"qp_code" text,
	"classification" text,
	"collector_district" text,
	"status" text DEFAULT 'captured' NOT NULL,
	"handoff_comment" text,
	"handed_over_at" text,
	"handed_over_by" text,
	"comment" text,
	"flags" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "requirement_version" (
	"id" text PRIMARY KEY NOT NULL,
	"requirement_id" text NOT NULL,
	"version" integer NOT NULL,
	"changed_at" text NOT NULL,
	"changed_by" text NOT NULL,
	"interaction_id" text,
	"diff_json" text NOT NULL,
	"snapshot_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"company_code" text NOT NULL,
	"requirement_id" text,
	"user_id" text,
	"title" text NOT NULL,
	"due_date" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by_interaction" text,
	"closed_by_interaction" text,
	"created_at" text NOT NULL,
	"closed_at" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'caller' NOT NULL,
	"team" "user_team" DEFAULT 'rg' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_first_seen_batch_import_batch_id_fk" FOREIGN KEY ("first_seen_batch") REFERENCES "public"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_last_seen_batch_import_batch_id_fk" FOREIGN KEY ("last_seen_batch") REFERENCES "public"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_company_code_company_company_code_fk" FOREIGN KEY ("company_code") REFERENCES "public"."company"("company_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edb_raw" ADD CONSTRAINT "edb_raw_batch_id_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_company_code_company_company_code_fk" FOREIGN KEY ("company_code") REFERENCES "public"."company"("company_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_company_code_company_company_code_fk" FOREIGN KEY ("company_code") REFERENCES "public"."company"("company_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_edb_row_id_edb_raw_id_fk" FOREIGN KEY ("edb_row_id") REFERENCES "public"."edb_raw"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_version" ADD CONSTRAINT "requirement_version_requirement_id_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_company_code_company_company_code_fk" FOREIGN KEY ("company_code") REFERENCES "public"."company"("company_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_requirement_id_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_interaction_interaction_id_fk" FOREIGN KEY ("created_by_interaction") REFERENCES "public"."interaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_closed_by_interaction_interaction_id_fk" FOREIGN KEY ("closed_by_interaction") REFERENCES "public"."interaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_company_district" ON "company" USING btree ("district");--> statement-breakpoint
CREATE INDEX "ix_company_rank" ON "company" USING btree ("company_rank");--> statement-breakpoint
CREATE INDEX "ix_company_last_contact" ON "company" USING btree ("last_contact_at");--> statement-breakpoint
CREATE INDEX "ix_contact_company" ON "contact" USING btree ("company_code");--> statement-breakpoint
CREATE INDEX "ix_contact_mobile" ON "contact" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "ix_edb_raw_company" ON "edb_raw" USING btree ("company_code");--> statement-breakpoint
CREATE INDEX "ix_inter_company" ON "interaction" USING btree ("company_code");--> statement-breakpoint
CREATE INDEX "ix_inter_user" ON "interaction" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_req_company" ON "requirement" USING btree ("company_code");--> statement-breakpoint
CREATE INDEX "ix_req_status" ON "requirement" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_req_natural" ON "requirement" USING btree ("reference_id","role_name","created_at_edb");--> statement-breakpoint
CREATE INDEX "ix_reqver_req" ON "requirement_version" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "ix_task_user_due" ON "task" USING btree ("user_id","status","due_date");