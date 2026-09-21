/**
 * Exact gap between Validated and Handed over — both directions.
 *
 *   npx tsx src/scripts/validated-handover-gap.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

function n(v: unknown): number {
  return Number(v) || 0;
}
function head(t: string) {
  console.log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);
}

const VALID = `required_count_validated > 0`;
const ROUTED = `classification IS NOT NULL AND classification <> ''`;

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  // ── Role-level four-way split ──
  const [roles] = await q(`
    SELECT
      COUNT(*) FILTER (WHERE ${VALID} AND ${ROUTED})::int          AS both,
      COUNT(*) FILTER (WHERE ${VALID} AND NOT (${ROUTED}))::int    AS valid_only,
      COUNT(*) FILTER (WHERE NOT (${VALID}) AND ${ROUTED})::int    AS routed_only,
      COALESCE(SUM(required_count_validated) FILTER
        (WHERE ${VALID} AND ${ROUTED}),0)::int                     AS both_openings,
      COALESCE(SUM(required_count_validated) FILTER
        (WHERE ${VALID} AND NOT (${ROUTED})),0)::int               AS valid_only_openings
    FROM requirement`);

  head("ROLE LEVEL — WHERE THE 32 GO");
  console.log(`  Validated AND routed        ${String(n(roles.both)).padStart(5)} roles  ${String(n(roles.both_openings)).padStart(6)} openings`);
  console.log(`  Validated, NOT routed       ${String(n(roles.valid_only)).padStart(5)} roles  ${String(n(roles.valid_only_openings)).padStart(6)} openings   <- GAP`);
  console.log(`  Routed, NOT validated       ${String(n(roles.routed_only)).padStart(5)} roles       0 openings   <- count missing`);
  console.log(`  ${"-".repeat(60)}`);
  console.log(`  Validated total             ${String(n(roles.both) + n(roles.valid_only)).padStart(5)} roles`);
  console.log(`  Routed total                ${String(n(roles.both) + n(roles.routed_only)).padStart(5)} roles`);

  // ── Company-level ──
  const [cos] = await q(`
    WITH v AS (SELECT DISTINCT company_code FROM requirement WHERE ${VALID}),
         r AS (SELECT DISTINCT company_code FROM requirement WHERE ${ROUTED})
    SELECT
      (SELECT COUNT(*)::int FROM v)                                          AS validated,
      (SELECT COUNT(*)::int FROM r)                                          AS routed,
      (SELECT COUNT(*)::int FROM (SELECT company_code FROM v
         INTERSECT SELECT company_code FROM r) x)                            AS both,
      (SELECT COUNT(*)::int FROM (SELECT company_code FROM v
         EXCEPT SELECT company_code FROM r) x)                               AS valid_only,
      (SELECT COUNT(*)::int FROM (SELECT company_code FROM r
         EXCEPT SELECT company_code FROM v) x)                               AS routed_only`);

  head("COMPANY LEVEL");
  console.log(`  Validated AND routed        ${String(n(cos.both)).padStart(5)}`);
  console.log(`  Validated, NOT routed       ${String(n(cos.valid_only)).padStart(5)}   <- GAP`);
  console.log(`  Routed, NOT validated       ${String(n(cos.routed_only)).padStart(5)}   <- no count on any role`);
  console.log(`  ${"-".repeat(40)}`);
  console.log(`  Validated total             ${String(n(cos.validated)).padStart(5)}`);
  console.log(`  Routed total                ${String(n(cos.routed)).padStart(5)}`);

  // ── The gap roles, named ──
  const gapRoles = await q(`
    SELECT c.company_name, c.tier, r.role_name,
           r.required_count_validated AS openings, r.status,
           CASE WHEN r.qualification IS NULL OR r.qualification = ''
                THEN 'no qualification' ELSE 'has qualification' END AS qual,
           CASE WHEN r.experience_from IS NULL OR r.experience_to IS NULL
                THEN 'no experience' ELSE 'has experience' END AS exp
    FROM requirement r
    INNER JOIN company c ON c.company_code = r.company_code
    WHERE ${VALID} AND NOT (${ROUTED})
    ORDER BY r.required_count_validated DESC`);

  head(`THE GAP — ${gapRoles.length} VALIDATED ROLES WITH NO ROUTE`);
  console.log("\n  Company                            Tier  Openings  Role");
  console.log("  " + "-".repeat(74));
  for (const r of gapRoles) {
    console.log(
      "  " + String(r.company_name ?? "").slice(0, 32).padEnd(34) +
      String(r.tier ?? "-").padStart(4) +
      String(r.openings).padStart(10) + "  " +
      String(r.role_name ?? "").slice(0, 24)
    );
  }

  // Why blocked — gate fields on gap roles
  const [blockers] = await q(`
    SELECT
      COUNT(*) FILTER (WHERE qualification IS NULL OR qualification = '')::int AS no_qual,
      COUNT(*) FILTER (WHERE experience_from IS NULL
                          OR experience_to IS NULL)::int                       AS no_exp,
      COUNT(*) FILTER (WHERE handoff_comment IS NULL
                          OR handoff_comment = '')::int                        AS no_comment,
      COUNT(*)::int AS total
    FROM requirement WHERE ${VALID} AND NOT (${ROUTED})`);

  head("WHY GAP ROLES NOT ROUTED — MISSING GATE FIELDS");
  console.log(`  Of ${n(blockers.total)} gap roles:`);
  console.log(`    no qualification   ${String(n(blockers.no_qual)).padStart(4)}`);
  console.log(`    no experience      ${String(n(blockers.no_exp)).padStart(4)}`);
  console.log(`    no handoff comment ${String(n(blockers.no_comment)).padStart(4)}`);

  // ── Reverse: routed but not validated ──
  const reverse = await q(`
    SELECT c.company_name, r.role_name, r.classification,
           r.required_count_validated AS openings, r.status
    FROM requirement r
    INNER JOIN company c ON c.company_code = r.company_code
    WHERE NOT (${VALID}) AND ${ROUTED}
    ORDER BY c.company_name LIMIT 40`);

  head(`REVERSE — ${reverse.length} ROUTED ROLES WITH NO VACANCY COUNT`);
  console.log("\n  Company                          Route       Count  Role");
  console.log("  " + "-".repeat(74));
  for (const r of reverse) {
    console.log(
      "  " + String(r.company_name ?? "").slice(0, 30).padEnd(32) +
      String(r.classification ?? "").padEnd(12) +
      String(r.openings ?? "null").padStart(5) + "  " +
      String(r.role_name ?? "").slice(0, 22)
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
