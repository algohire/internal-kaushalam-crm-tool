/**
 * Post-remap check: reason mix on No requirement calls, funnel totals, and
 * that the audit trail and follow-up tasks landed. Read-only.
 *
 *   npx tsx src/scripts/verify-reason-remap.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const CONNECTED = `('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')`;

async function main() {
  const reasons = (await sql.query(`
    SELECT lc.reason_code, COUNT(*)::int c FROM company cc
    JOIN LATERAL (SELECT i.* FROM interaction i WHERE i.company_code = cc.company_code
                  AND i.disposition IN ${CONNECTED} ORDER BY i.created_at DESC LIMIT 1) lc ON true
    WHERE lc.disposition = 'no_requirement'
      AND NOT EXISTS (SELECT 1 FROM requirement q WHERE q.company_code = cc.company_code
                        AND q.required_count_validated > 0)
    GROUP BY 1 ORDER BY 2 DESC`)) as Record<string, unknown>[];

  console.log("Reasons on the latest No requirement call (companies in the Connected-to-Validated drop):");
  const total = reasons.reduce((s, r) => s + Number(r.c), 0);
  for (const r of reasons) {
    console.log(`  ${String(r.c).padStart(4)}  ${((Number(r.c) / total) * 100).toFixed(1).padStart(5)}%  ${r.reason_code}`);
  }

  const [f] = (await sql.query(`SELECT
    (SELECT COUNT(DISTINCT company_code) FROM interaction)::int AS attempted,
    (SELECT COUNT(DISTINCT company_code) FROM interaction WHERE disposition IN ${CONNECTED})::int AS connected,
    (SELECT COUNT(DISTINCT company_code) FROM requirement WHERE required_count_validated > 0)::int AS validated,
    (SELECT COUNT(DISTINCT company_code) FROM requirement WHERE classification <> '')::int AS handed_over,
    (SELECT COUNT(*) FROM task WHERE status = 'open'
       AND title LIKE 'Follow up — employer said%')::int AS follow_up_tasks,
    (SELECT COUNT(*) FROM audit_log WHERE action = 'reason_remap')::int AS audit_rows,
    (SELECT COUNT(*) FROM interaction WHERE reason_code = 'Other (comment)')::int AS other_calls_left`)) as Record<string, unknown>[];
  console.log("\nFunnel and checks:", f);

  console.log("\nCall outcomes now:");
  for (const d of (await sql.query(
    `SELECT disposition, COUNT(*)::int c FROM interaction GROUP BY 1 ORDER BY 2 DESC`)) as Record<string, unknown>[]) {
    console.log(`  ${String(d.c).padStart(5)}  ${d.disposition}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
