/**
 * Confirms the reset companies are back to "never called" and shows the funnel
 * after it. Read-only.
 *
 *   npx tsx src/scripts/verify-company-reset.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const sql = neon(process.env.DATABASE_URL!);
const CONNECTED = `('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')`;

async function main() {
  const backup = JSON.parse(readFileSync("data/backup-company-reset-2026-09-21.json", "utf-8")) as {
    companies: { company_code: string }[];
  };
  const codes = backup.companies.map((c) => c.company_code);

  const [check] = (await sql.query(`SELECT
    (SELECT COUNT(*) FROM interaction WHERE company_code = ANY($1))::int AS calls_left,
    (SELECT COUNT(*) FROM requirement WHERE company_code = ANY($1)
       AND (required_count_validated IS NOT NULL OR classification IS NOT NULL
            OR status <> 'captured' OR version <> 1))::int AS roles_not_clean,
    (SELECT COUNT(*) FROM requirement WHERE company_code = ANY($1))::int AS roles_kept,
    (SELECT COUNT(*) FROM requirement_version v JOIN requirement r ON r.id = v.requirement_id
       WHERE r.company_code = ANY($1))::int AS versions_left,
    (SELECT COUNT(*) FROM edb_outbox WHERE company_code = ANY($1))::int AS outbox_left,
    (SELECT COUNT(*) FROM company WHERE company_code = ANY($1) AND last_disposition IS NULL)::int AS companies_clear,
    (SELECT COUNT(*) FROM task WHERE company_code = ANY($1) AND status = 'open')::int AS open_tasks,
    (SELECT COUNT(*) FROM audit_log WHERE action = 'company_reset')::int AS audit_rows`,
    [codes])) as Record<string, unknown>[];
  console.log("Reset companies:", check);

  const [f] = (await sql.query(`SELECT
    (SELECT COUNT(*) FROM company)::int AS universe,
    (SELECT COUNT(DISTINCT company_code) FROM interaction)::int AS attempted,
    (SELECT COUNT(DISTINCT company_code) FROM interaction WHERE disposition IN ${CONNECTED})::int AS connected,
    (SELECT COUNT(DISTINCT company_code) FROM requirement WHERE required_count_validated > 0)::int AS validated,
    (SELECT COUNT(DISTINCT company_code) FROM requirement
       WHERE classification IS NOT NULL AND classification <> '')::int AS handed_over,
    (SELECT COUNT(DISTINCT company_code) FROM requirement WHERE status LIKE 'handed_over_%')::int AS dispatched`
  )) as Record<string, unknown>[];
  console.log("\nFunnel now:", f);

  const gap = (await sql.query(`
    SELECT c.company_code, c.company_name FROM company c
    WHERE EXISTS (SELECT 1 FROM requirement r WHERE r.company_code = c.company_code
                    AND r.required_count_validated > 0)
      AND NOT EXISTS (SELECT 1 FROM requirement r WHERE r.company_code = c.company_code
                        AND r.classification IS NOT NULL AND r.classification <> '')
    ORDER BY c.company_rank`)) as Record<string, unknown>[];
  console.log(`\nValidated with no route left: ${gap.length}`);
  for (const g of gap) console.log(`  ${g.company_code}  ${g.company_name}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
