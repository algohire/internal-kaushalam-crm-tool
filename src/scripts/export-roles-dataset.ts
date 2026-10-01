/**
 * Full role-level dataset export — one row per role, with company, contact,
 * validation and handover metadata joined in.
 *
 *   npx tsx src/scripts/export-roles-dataset.ts
 *   npx tsx src/scripts/export-roles-dataset.ts --tier 1
 *   npx tsx src/scripts/export-roles-dataset.ts --validated-only
 *   npx tsx src/scripts/export-roles-dataset.ts --district Guntur
 *
 * Writes to data/roles-dataset-YYYY-MM-DD[-suffix].csv
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { writeFileSync } from "fs";

/** Guards against CSV formula injection when opened in Excel. */
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const ROUTE_LABELS: Record<string, string> = {
  handed_over_scheduling: "Scheduling",
  handed_over_collector: "Collector",
  handed_over_apssdc: "APSSDC",
};

/** Falls back to the route itself where a role is decided but not yet dispatched. */
const CLASSIFICATION_LABELS: Record<string, string> = {
  kaushalam: "Scheduling",
  collector: "Collector",
  apssdc: "APSSDC",
};

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    }
  }

  const where: string[] = [];
  if (flags.tier) where.push(`c.tier = ${parseInt(flags.tier, 10)}`);
  if (flags.district) where.push(`c.district = '${flags.district.replace(/'/g, "''")}'`);
  if (flags["validated-only"]) where.push(`r.required_count_validated > 0`);
  if (flags["handed-over-only"]) where.push(`r.status LIKE 'handed_over_%'`);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  console.log("\nBuilding role-level dataset…");

  const [rows, qualMasterRows] = await Promise.all([
    sql.query(`
      SELECT
        -- company
        c.company_code, c.company_name, c.legal_name, c.tier, c.company_rank,
        c.district, c.mandal, c.village, c.sector, c.sectors, c.subsectors,
        c.stage, c.present_headcount, c.total_required, c.gstin, c.pan,
        c.flags AS company_flags, c.tags AS company_tags,
        c.last_disposition, c.last_contact_at, c.contact_count,
        -- role, as recorded on EDB
        r.id AS requirement_id, r.reference_id, r.role_name, r.is_custom,
        r.current_employment, r.required_count, r.required_within_months,
        r.skills, r.created_at_edb,
        -- role, as captured by the caller
        r.role_name_edited, r.required_count_validated, r.qualification,
        r.experience_from, r.experience_to, r.gender_preference, r.age_limit,
        r.salary, r.pwd, r.need_training, r.qp_code,
        r.timing, r.timing_date, r.comment AS role_comment,
        r.classification, r.collector_district, r.status,
        r.handoff_comment, r.handed_over_at, r.handed_over_by,
        r.flags AS role_flags, r.version, r.updated_at, r.updated_by,
        -- primary contact
        ct.name AS contact_name, ct.designation AS contact_designation,
        ct.mobile AS contact_mobile, ct.email AS contact_email,
        -- call history on the company
        ic.calls, ic.connected_calls, ic.first_call_at,
        lc.disposition AS last_call_disposition, lc.reason_code AS last_call_reason,
        lc.comment AS last_call_comment, lc.username AS last_call_by,
        lc.channel AS last_call_channel, lc.created_at AS last_call_at,
        lc.next_step, lc.next_action_date,
        cc.disposition AS last_connected_disposition, cc.reason_code AS last_connected_reason,
        cc.comment AS last_connected_comment, cc.username AS last_connected_by,
        cc.created_at AS last_connected_at,
        tk.open_tasks, tk.next_task, tk.next_task_due
      FROM requirement r
      INNER JOIN company c ON c.company_code = r.company_code
      LEFT JOIN LATERAL (
        SELECT name, designation, mobile, email
        FROM contact
        WHERE company_code = r.company_code AND valid = true
        ORDER BY is_primary DESC, created_at ASC
        LIMIT 1
      ) ct ON true
      -- most recent call on the company, whatever its outcome
      LEFT JOIN LATERAL (
        SELECT disposition, reason_code, comment, username, channel,
               created_at, next_step, next_action_date
        FROM interaction WHERE company_code = r.company_code
        ORDER BY created_at DESC LIMIT 1
      ) lc ON true
      -- most recent call that actually reached someone
      LEFT JOIN LATERAL (
        SELECT disposition, reason_code, comment, username, created_at
        FROM interaction WHERE company_code = r.company_code
          AND disposition IN ('hiring_now','hiring_later','no_requirement',
                              'not_operational','do_not_call')
        ORDER BY created_at DESC LIMIT 1
      ) cc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS calls,
               COUNT(*) FILTER (WHERE disposition IN ('hiring_now','hiring_later',
                 'no_requirement','not_operational','do_not_call'))::int AS connected_calls,
               MIN(created_at) AS first_call_at
        FROM interaction WHERE company_code = r.company_code
      ) ic ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS open_tasks, MIN(due_date) AS next_task_due,
               (array_agg(title ORDER BY due_date))[1] AS next_task
        FROM task WHERE company_code = r.company_code AND status = 'open'
      ) tk ON true
      ${whereSql}
      ORDER BY c.tier NULLS LAST, c.company_rank, c.company_name, r.role_name
    `),
    sql.query(`SELECT id, name FROM qualification_master`),
  ]);

  if (rows.length === 0) {
    console.log("No rows match those filters.");
    process.exit(0);
  }

  const qualMap: Record<string, string> = {};
  for (const m of qualMasterRows) qualMap[m.id as string] = m.name as string;
  const resolveQuals = (raw: unknown): string => {
    if (!raw) return "";
    return String(raw)
      .split(";")
      .map((id) => qualMap[id.trim()] ?? id.trim())
      .filter(Boolean)
      .join("; ");
  };

  const headers = [
    "company_code", "company_name", "legal_name", "tier", "company_rank",
    "district", "mandal", "village", "sector", "sectors", "subsectors",
    "company_stage", "present_headcount", "total_required_edb", "gstin", "pan",
    "company_flags", "company_tags",
    "last_disposition", "last_contact_at", "call_count",
    "requirement_id", "reference_id", "role_name", "role_name_edited", "is_custom",
    "current_employment", "openings_edb", "required_within_months", "skills",
    "created_at_edb",
    "openings_validated", "is_validated",
    "qualification", "experience_from", "experience_to", "gender_preference",
    "age_limit", "salary", "pwd", "need_training", "qp_code",
    "timing", "timing_date", "role_comment",
    "classification", "route_label", "is_handed_over", "is_dispatched",
    "collector_district", "status",
    "handoff_comment", "handed_over_at", "handed_over_by",
    "role_flags", "version", "updated_at", "updated_by",
    "contact_name", "contact_designation", "contact_mobile", "contact_email",
    "calls", "connected_calls", "first_call_at",
    "last_call_disposition", "last_call_reason", "last_call_comment", "last_call_by",
    "last_call_channel", "last_call_at", "next_step", "next_action_date",
    "last_connected_disposition", "last_connected_reason", "last_connected_comment",
    "last_connected_by", "last_connected_at",
    "open_tasks", "next_task", "next_task_due",
  ];

  const lines = [headers.join(",")];

  for (const r of rows as Record<string, unknown>[]) {
    const validatedCount = Number(r.required_count_validated) || 0;
    lines.push(
      [
        r.company_code, r.company_name, r.legal_name, r.tier, r.company_rank,
        r.district, r.mandal, r.village, r.sector, r.sectors, r.subsectors,
        r.stage, r.present_headcount, r.total_required, r.gstin, r.pan,
        r.company_flags, r.company_tags,
        r.last_disposition, r.last_contact_at, r.contact_count,
        r.requirement_id, r.reference_id, r.role_name, r.role_name_edited,
        r.is_custom ? "yes" : "no",
        r.current_employment, r.required_count, r.required_within_months, r.skills,
        r.created_at_edb,
        r.required_count_validated, validatedCount > 0 ? "yes" : "no",
        resolveQuals(r.qualification),
        r.experience_from, r.experience_to, r.gender_preference,
        r.age_limit, r.salary,
        r.pwd ? "yes" : "no",
        r.need_training ? "yes" : "no",
        r.qp_code,
        r.timing, r.timing_date, r.role_comment,
        r.classification,
        ROUTE_LABELS[r.status as string] ?? CLASSIFICATION_LABELS[r.classification as string] ?? "",
        r.classification ? "yes" : "no",
        String(r.status ?? "").startsWith("handed_over_") ? "yes" : "no",
        r.collector_district, r.status,
        r.handoff_comment, r.handed_over_at, r.handed_over_by,
        r.role_flags, r.version, r.updated_at, r.updated_by,
        r.contact_name, r.contact_designation, r.contact_mobile, r.contact_email,
        r.calls, r.connected_calls, r.first_call_at,
        r.last_call_disposition, r.last_call_reason, r.last_call_comment, r.last_call_by,
        r.last_call_channel, r.last_call_at, r.next_step, r.next_action_date,
        r.last_connected_disposition, r.last_connected_reason, r.last_connected_comment,
        r.last_connected_by, r.last_connected_at,
        r.open_tasks, r.next_task, r.next_task_due,
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const suffix = flags.tier
    ? `-tier${flags.tier}`
    : flags.district
      ? `-${flags.district.toLowerCase().replace(/\s+/g, "-")}`
      : flags["validated-only"]
        ? "-validated"
        : flags["handed-over-only"]
          ? "-handed-over"
          : "";
  const outPath = `data/roles-dataset-${today}${suffix}.csv`;
  writeFileSync(outPath, lines.join("\n"), "utf-8");

  // Summary so the file's contents are obvious without opening it
  const companies = new Set(rows.map((r: Record<string, unknown>) => r.company_code));
  const validated = rows.filter((r: Record<string, unknown>) => Number(r.required_count_validated) > 0);
  const handed = rows.filter((r: Record<string, unknown>) => String(r.status ?? "").startsWith("handed_over_"));
  const openingsEdb = rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.required_count) || 0), 0);
  const openingsVal = validated.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.required_count_validated) || 0), 0);

  const byTier: Record<string, { roles: number; validated: number; openingsEdb: number; openingsVal: number }> = {};
  for (const r of rows as Record<string, unknown>[]) {
    const t = r.tier === null ? "none" : `T${r.tier}`;
    byTier[t] ??= { roles: 0, validated: 0, openingsEdb: 0, openingsVal: 0 };
    byTier[t].roles++;
    byTier[t].openingsEdb += Number(r.required_count) || 0;
    if (Number(r.required_count_validated) > 0) {
      byTier[t].validated++;
      byTier[t].openingsVal += Number(r.required_count_validated) || 0;
    }
  }

  console.log(`\nWrote ${outPath}`);
  console.log(`  ${rows.length.toLocaleString("en-IN")} roles across ${companies.size.toLocaleString("en-IN")} companies`);
  console.log(`  ${validated.length.toLocaleString("en-IN")} validated · ${handed.length.toLocaleString("en-IN")} handed over`);
  console.log(`  ${openingsEdb.toLocaleString("en-IN")} openings on EDB · ${openingsVal.toLocaleString("en-IN")} validated`);
  console.log(`  ${headers.length} columns\n`);
  console.log("  Tier    Roles  Validated  OpeningsEDB  OpeningsVal");
  console.log("  -----  -------  ---------  -----------  -----------");
  for (const t of Object.keys(byTier).sort()) {
    const v = byTier[t];
    console.log(
      "  " + t.padEnd(5) +
      String(v.roles).padStart(9) +
      String(v.validated).padStart(11) +
      String(v.openingsEdb).padStart(13) +
      String(v.openingsVal).padStart(13)
    );
  }
  console.log("");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
