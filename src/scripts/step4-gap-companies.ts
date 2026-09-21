/**
 * Step 4 drop-offs across all tiers: companies with a validated role
 * (count > 0) but no role with a route decided. Each is tagged with the
 * rule(s) it breaks. Also lists handed-over companies that still carry
 * rule-breaking roles. Read-only.
 *
 *   npx tsx src/scripts/step4-gap-companies.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const HIRING = `('hiring_now','hiring_later')`;
const CLOSED = `('no_requirement','not_operational','do_not_call','duplicate')`;

const cut = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

const PER_COMPANY = `
  SELECT c.tier, c.company_rank, c.company_code, c.company_name,
    (SELECT i.disposition FROM interaction i WHERE i.company_code = c.company_code
       ORDER BY i.created_at DESC LIMIT 1) AS last_disp,
    (SELECT i.username FROM interaction i WHERE i.company_code = c.company_code
       ORDER BY i.created_at DESC LIMIT 1) AS last_by,
    (SELECT i.comment FROM interaction i WHERE i.company_code = c.company_code
       ORDER BY i.created_at DESC LIMIT 1) AS last_comment,
    COUNT(*) FILTER (WHERE r.required_count_validated > 0)::int AS val_roles,
    COALESCE(SUM(r.required_count_validated) FILTER (WHERE r.required_count_validated > 0), 0)::int AS val_openings,
    COUNT(*) FILTER (WHERE r.required_count_validated > 0 AND COALESCE(r.classification,'') = '')::int AS r4,
    COUNT(*) FILTER (WHERE r.required_count_validated > 0 AND r.status IN ${CLOSED})::int AS r2,
    COUNT(*) FILTER (WHERE r.required_count_validated > 0 AND r.timing = 'not_hiring')::int AS r3,
    COUNT(*) FILTER (WHERE COALESCE(r.classification,'') <> ''
                     AND COALESCE(r.required_count_validated,0) = 0)::int AS r5,
    COUNT(*) FILTER (WHERE COALESCE(r.classification,'') <> '')::int AS routed,
    string_agg(DISTINCT r.updated_by, ', ') FILTER (WHERE r.required_count_validated > 0) AS editors,
    -- R1 is judged on the call that saved the count, not the latest call
    COUNT(*) FILTER (WHERE r.required_count_validated > 0 AND COALESCE(sv.disposition,'') NOT IN ${HIRING})::int AS r1,
    string_agg(DISTINCT sv.disposition, ', ') FILTER (WHERE r.required_count_validated > 0) AS saved_under
  FROM company c JOIN requirement r ON r.company_code = c.company_code
  LEFT JOIN LATERAL (
    SELECT i.disposition FROM requirement_version v
    JOIN interaction i ON i.id = v.interaction_id
    WHERE v.requirement_id = r.id
      AND (v.diff_json LIKE '%requiredCountValidated%' OR v.diff_json LIKE '%"_new"%')
    ORDER BY v.version DESC LIMIT 1
  ) sv ON true
  GROUP BY c.tier, c.company_rank, c.company_code, c.company_name`;

function tags(r: Record<string, unknown>): string {
  const t: string[] = [];
  if (Number(r.r1) > 0) t.push(`R1×${r.r1}`);
  if (Number(r.r2) > 0) t.push(`R2×${r.r2}`);
  if (Number(r.r3) > 0) t.push(`R3×${r.r3}`);
  if (Number(r.r4) > 0) t.push(`R4×${r.r4}`);
  if (Number(r.r5) > 0) t.push(`R5×${r.r5}`);
  return t.join(" ");
}

async function main() {
  const rows = (await sql.query(PER_COMPANY)) as Record<string, unknown>[];

  const gap = rows
    .filter((r) => Number(r.val_roles) > 0 && Number(r.routed) === 0)
    .sort((a, b) => Number(a.tier) - Number(b.tier) || Number(a.company_rank) - Number(b.company_rank));

  console.log(`\nSTEP 4 GAP — validated, nothing routed: ${gap.length} companies\n`);
  console.log("tier rank  code            company                                  roles open  saved under      rules              by");
  for (const r of gap) {
    console.log(
      `T${r.tier}  ${String(r.company_rank).padStart(5)}  ${String(r.company_code).padEnd(15)} ${cut(r.company_name, 40).padEnd(40)} ${String(r.val_roles).padStart(5)} ${String(r.val_openings).padStart(4)}  ${cut(r.saved_under, 14).padEnd(14)} ${tags(r).padEnd(18)} ${cut(r.editors, 30)}`
    );
    console.log(`${" ".repeat(24)}"${cut(r.last_comment, 120)}"`);
  }

  const partial = rows
    .filter((r) => Number(r.routed) > 0 && tags(r) !== "")
    .sort((a, b) => Number(a.tier) - Number(b.tier) || Number(a.company_rank) - Number(b.company_rank));

  console.log(`\n\nHANDED OVER BUT WITH RULE-BREAKING ROLES: ${partial.length} companies\n`);
  console.log("tier rank  code            company                                  roles open  saved under      rules              by");
  for (const r of partial) {
    console.log(
      `T${r.tier}  ${String(r.company_rank).padStart(5)}  ${String(r.company_code).padEnd(15)} ${cut(r.company_name, 40).padEnd(40)} ${String(r.val_roles).padStart(5)} ${String(r.val_openings).padStart(4)}  ${cut(r.saved_under, 14).padEnd(14)} ${tags(r).padEnd(18)} ${cut(r.editors, 30)}`
    );
  }
  console.log("");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
