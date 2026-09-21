/**
 * What is the real "handed over" company count, under every plausible definition?
 *
 *   npx tsx src/scripts/check-handover-count.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

function n(v: unknown): number {
  return Number(v) || 0;
}
function head(t: string) {
  console.log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  head("COMPANY COUNT UNDER EACH DEFINITION");

  const defs: [string, string][] = [
    [
      "A. >=1 role with status LIKE 'handed_over_%'",
      `SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE status LIKE 'handed_over_%'`,
    ],
    [
      "B. >=1 role with handed_over_at stamped",
      `SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE handed_over_at IS NOT NULL`,
    ],
    [
      "C. >=1 role with handed_over_by set",
      `SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE handed_over_by IS NOT NULL`,
    ],
    [
      "D. >=1 role with a classification set",
      `SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE classification IS NOT NULL AND classification <> ''`,
    ],
    [
      "E. >=1 role classified AND has a handoff comment",
      `SELECT COUNT(DISTINCT company_code)::int c FROM requirement
       WHERE classification IS NOT NULL AND classification <> ''
         AND handoff_comment IS NOT NULL AND handoff_comment <> ''`,
    ],
    [
      "F. ALL validated roles classified (the 'Classified' stage)",
      `SELECT COUNT(*)::int c FROM (
         SELECT company_code FROM requirement WHERE required_count_validated > 0
         GROUP BY company_code
         HAVING COUNT(*) FILTER (WHERE classification IS NULL OR classification = '') = 0) s`,
    ],
  ];

  for (const [label, text] of defs) {
    const [r] = await q(text);
    console.log(`  ${label.padEnd(58)}${String(n(r.c)).padStart(6)}`);
  }

  // Is status ever out of sync with the stamps?
  head("IS status EVER OUT OF SYNC WITH THE HANDOVER STAMPS?");
  const [sync] = await q(`
    SELECT
      COUNT(*) FILTER (WHERE status LIKE 'handed_over_%'
                         AND handed_over_at IS NULL)::int AS status_no_stamp,
      COUNT(*) FILTER (WHERE status NOT LIKE 'handed_over_%'
                         AND handed_over_at IS NOT NULL)::int AS stamp_no_status,
      COUNT(*) FILTER (WHERE status LIKE 'handed_over_%')::int AS handed_roles
    FROM requirement`);
  console.log(`  Roles with handed_over status : ${n(sync.handed_roles)}`);
  console.log(`  ...but no timestamp           : ${n(sync.status_no_stamp)}`);
  console.log(`  Roles stamped but status not handed_over : ${n(sync.stamp_no_status)}`);
  console.log(
    n(sync.status_no_stamp) === 0 && n(sync.stamp_no_status) === 0
      ? `  -> Perfectly in sync. status is reliable.`
      : `  -> OUT OF SYNC. Investigate.`
  );

  // Companies with a mix of handed and not-handed roles
  head("COMPANIES WITH A MIX OF HANDED AND UNHANDED ROLES");
  const mix = await q(`
    WITH per_company AS (
      SELECT company_code,
             COUNT(*)::int total,
             COUNT(*) FILTER (WHERE status LIKE 'handed_over_%')::int handed
      FROM requirement GROUP BY company_code)
    SELECT
      CASE WHEN handed = 0 THEN 'No roles handed over'
           WHEN handed = total THEN 'Every role handed over'
           ELSE 'Some roles handed over' END AS shape,
      COUNT(*)::int companies
    FROM per_company GROUP BY 1 ORDER BY 1`);
  for (const r of mix) {
    console.log(`  ${String(r.shape).padEnd(30)}${String(r.companies).padStart(6)}`);
  }

  head("WHAT THE 'HANDED OVER' PAGE LISTS");
  const [pageRows] = await q(`
    SELECT COUNT(*)::int roles,
           COUNT(DISTINCT company_code)::int companies
    FROM requirement WHERE status LIKE 'handed_over_%'`);
  console.log(`  ${n(pageRows.roles)} roles across ${n(pageRows.companies)} companies`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
