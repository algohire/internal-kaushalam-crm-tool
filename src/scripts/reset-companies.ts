/**
 * Puts a company back to "never called": caller work is removed and the EDB
 * record is left exactly as it was ingested, so it can be called afresh.
 * Dry run unless --apply is passed; a backup of everything removed is written
 * either way.
 *
 *   npx tsx src/scripts/reset-companies.ts [--apply]
 *
 * Per company it removes the calls, role version history, call-created tasks
 * and unsent EDB outbox rows, deletes roles the callers added, and clears every
 * caller-entered field on the EDB roles. EDB fields (role name, required count,
 * skills) are never touched. The audit trail is kept and a reset entry added.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";

const sql = neon(process.env.DATABASE_URL!);
const APPLY = process.argv.includes("--apply");
const now = new Date().toISOString();
const today = now.split("T")[0];

/** Approved 21 Sep 2026: counts that contradict the call, or were entered
 *  from information the caller's own note says was never collected. */
const TARGETS: { code: string; why: string }[] = [
  // Record contradicts itself
  { code: "EDB-352-7611", why: "Do not call + role closed, yet count 10" },
  { code: "EDB-WI4-KLXB", why: "Count 100 with role closed and timing not hiring" },
  { code: "EDB-O01-TWUU", why: "Closed role still carries a count" },
  { code: "EDB-5DP-JI5X", why: "Closed role still carries a count" },
  { code: "EDB-8DM-KHA9", why: "Closed role still carries a count" },
  // Counts entered from information the caller says was never collected
  { code: "APIND-100", why: "Note says 'no proper information'" },
  { code: "EDB-RAQ-YYJL", why: "Note says 'no proper response yet to call again'" },
  { code: "EDB-WBU-RYQC", why: "One hire counted across three roles" },
  // Counted as handed over, but the count came from a call nobody confirmed on
  { code: "EDB-677-7062", why: "Count saved on a No requirement call" },
  { code: "APIND-036", why: "4 roles / 43 openings saved on a No requirement call" },
  { code: "EDB-5AN-YJ53", why: "Count saved on a No requirement call" },
  { code: "EDB-N5L-0KSY", why: "Count saved on a No answer call" },
  { code: "EDB-T9B-K6YM", why: "Count saved on a No answer call" },
  { code: "EDB-TVJ-VJ4Z", why: "Count saved on a No requirement call" },
  { code: "EDB-0BA-7D52", why: "Count saved on a No answer call" },
  { code: "EDB-1AS-OQ6V", why: "Count saved on a No answer call" },
  { code: "EDB-1KH-D9BL", why: "Count saved on a No answer call" },
  { code: "EDB-GRR-9JY3", why: "Count saved on a No requirement call" },
  { code: "EDB-5KC-QVIQ", why: "Count saved on a No answer call" },
  { code: "EDB-5UQ-WJOD", why: "Count saved on a No answer call" },
];

/** Every caller-entered column on a requirement, back to its ingested state. */
const CLEAR_ROLE = `
  role_name_edited = NULL, standard_role = NULL, required_count_validated = NULL,
  timing = NULL, timing_date = NULL, qualification = NULL, experience = NULL,
  gender_preference = NULL, age_limit = NULL, salary = NULL,
  experience_from = NULL, experience_to = NULL, pwd = false, need_training = false,
  qp_code = NULL, classification = NULL, collector_district = NULL,
  status = 'captured', handoff_comment = NULL, handed_over_at = NULL,
  handed_over_by = NULL, comment = NULL, version = 1, updated_by = NULL`;

const n = (v: unknown) => Number(v) || 0;

async function main() {
  const codes = TARGETS.map((t) => t.code);
  const why = new Map(TARGETS.map((t) => [t.code, t.why]));

  const state = (await sql.query(`
    SELECT c.company_code, c.company_name, c.tier, c.company_rank,
           c.last_disposition, c.contact_count,
           (SELECT COUNT(*) FROM requirement r WHERE r.company_code = c.company_code)::int AS roles,
           (SELECT COUNT(*) FROM requirement r WHERE r.company_code = c.company_code
              AND r.reference_id LIKE 'CALLER-%')::int AS caller_roles,
           (SELECT COUNT(*) FROM requirement r WHERE r.company_code = c.company_code
              AND r.required_count_validated > 0)::int AS validated_roles,
           (SELECT COALESCE(SUM(r.required_count_validated),0) FROM requirement r
              WHERE r.company_code = c.company_code AND r.required_count_validated > 0)::int AS validated_openings,
           (SELECT COUNT(*) FROM requirement r WHERE r.company_code = c.company_code
              AND r.status LIKE 'handed_over_%')::int AS dispatched_roles,
           (SELECT COUNT(*) FROM interaction i WHERE i.company_code = c.company_code)::int AS calls,
           (SELECT COUNT(*) FROM task t WHERE t.company_code = c.company_code
              AND t.created_by_interaction IS NOT NULL)::int AS call_tasks,
           (SELECT COUNT(*) FROM task t WHERE t.company_code = c.company_code
              AND t.created_by_interaction IS NULL AND t.status = 'open')::int AS seed_tasks,
           (SELECT COUNT(*) FROM edb_outbox o WHERE o.company_code = c.company_code)::int AS outbox,
           (SELECT COUNT(*) FROM edb_outbox o WHERE o.company_code = c.company_code
              AND o.sent_at IS NOT NULL)::int AS outbox_sent,
           (SELECT COUNT(*) FROM requirement_version v JOIN requirement r ON r.id = v.requirement_id
              WHERE r.company_code = c.company_code)::int AS versions
    FROM company c WHERE c.company_code = ANY($1)
    ORDER BY c.tier, c.company_rank`, [codes])) as Record<string, unknown>[];

  if (state.length !== TARGETS.length) {
    throw new Error(`Expected ${TARGETS.length} companies, found ${state.length}`);
  }
  const sent = state.filter((s) => n(s.outbox_sent) > 0);
  if (sent.length > 0) {
    throw new Error(`Already sent to EDB, refusing: ${sent.map((s) => s.company_code).join(", ")}`);
  }

  console.log(`\n${state.length} companies to reset\n`);
  console.log("tier rank  code            company                            roles(cal) val open disp calls tasks vers");
  for (const s of state) {
    console.log(
      `T${s.tier} ${String(s.company_rank).padStart(5)}  ${String(s.company_code).padEnd(15)} ` +
      `${String(s.company_name).slice(0, 33).padEnd(33)} ${String(s.roles).padStart(4)}(${s.caller_roles}) ` +
      `${String(s.validated_roles).padStart(3)} ${String(s.validated_openings).padStart(4)} ` +
      `${String(s.dispatched_roles).padStart(4)} ${String(s.calls).padStart(5)} ` +
      `${String(s.call_tasks).padStart(5)} ${String(s.versions).padStart(4)}`
    );
  }

  const totals = (k: string) => state.reduce((t, s) => t + n(s[k]), 0);
  console.log(
    `\nto remove: ${totals("calls")} calls · ${totals("versions")} role versions · ` +
    `${totals("call_tasks")} call tasks · ${totals("outbox")} outbox rows · ` +
    `${totals("caller_roles")} caller-added roles`);
  console.log(
    `to clear:  ${totals("validated_roles")} validated roles (${totals("validated_openings")} openings) · ` +
    `${totals("dispatched_roles")} already dispatched to Scheduling`);
  const noSeed = state.filter((s) => n(s.seed_tasks) === 0);
  if (noSeed.length > 0) {
    console.log(`\n${noSeed.length} companies have no open first-call task; one will be created.`);
  }

  // Full backup of everything that is about to be removed or changed.
  const backup = {
    resetAt: now, companies: state,
    requirements: await sql.query(`SELECT * FROM requirement WHERE company_code = ANY($1)`, [codes]),
    interactions: await sql.query(`SELECT * FROM interaction WHERE company_code = ANY($1)`, [codes]),
    versions: await sql.query(
      `SELECT v.* FROM requirement_version v JOIN requirement r ON r.id = v.requirement_id
       WHERE r.company_code = ANY($1)`, [codes]),
    tasks: await sql.query(`SELECT * FROM task WHERE company_code = ANY($1)`, [codes]),
    outbox: await sql.query(`SELECT * FROM edb_outbox WHERE company_code = ANY($1)`, [codes]),
  };
  const file = `data/backup-company-reset-${today}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 1));
  console.log(`\nbackup written: ${file}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
    return;
  }

  const statements: ReturnType<typeof sql>[] = [];
  for (const s of state) {
    const code = s.company_code as string;
    statements.push(sql`DELETE FROM requirement_version WHERE requirement_id IN
                          (SELECT id FROM requirement WHERE company_code = ${code})`);
    statements.push(sql`DELETE FROM edb_outbox WHERE company_code = ${code}`);
    statements.push(sql`DELETE FROM task WHERE company_code = ${code} AND created_by_interaction IS NOT NULL`);
    statements.push(sql`DELETE FROM interaction WHERE company_code = ${code}`);
    statements.push(sql`DELETE FROM requirement WHERE company_code = ${code} AND reference_id LIKE 'CALLER-%'`);
    statements.push(sql.query(
      `UPDATE requirement SET ${CLEAR_ROLE}, updated_at = $1 WHERE company_code = $2`, [now, code]));
    statements.push(sql`UPDATE company SET last_disposition = NULL, last_contact_at = NULL,
                          contact_count = 0, updated_at = ${now} WHERE company_code = ${code}`);
    if (n(s.seed_tasks) === 0) {
      statements.push(sql`INSERT INTO task (id, company_code, user_id, title, due_date, source, status, created_at)
                          VALUES (${crypto.randomUUID()}, ${code}, NULL,
                            'First call — validate EDB requirement', ${today}, 'new_requirement', 'open', ${now})`);
    }
    statements.push(sql`INSERT INTO audit_log (id, user_id, username, action, object_type, object_id,
                          detail_json, created_at)
                        VALUES (${crypto.randomUUID()}, NULL, 'system', 'company_reset', 'company', ${code},
                          ${JSON.stringify({
                            reason: why.get(code), backup: file,
                            removed: {
                              calls: n(s.calls), versions: n(s.versions), callTasks: n(s.call_tasks),
                              outbox: n(s.outbox), callerRoles: n(s.caller_roles),
                            },
                            cleared: {
                              validatedRoles: n(s.validated_roles), validatedOpenings: n(s.validated_openings),
                              dispatchedRoles: n(s.dispatched_roles),
                            },
                          })}, ${now})`);
  }

  const SIZE = 50;
  for (let i = 0; i < statements.length; i += SIZE) {
    await sql.transaction(statements.slice(i, i + SIZE));
    process.stdout.write(`  committed ${Math.min(i + SIZE, statements.length)}/${statements.length}\r`);
  }
  console.log(`\nCOMMITTED ${statements.length} statements for ${state.length} companies`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
