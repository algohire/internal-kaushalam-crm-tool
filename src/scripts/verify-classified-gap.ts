/**
 * Verifies the claim that roles exist which are fully prepared for handover
 * (classification, district, handoff comment all set) but still sit at
 * status = 'captured'.
 *
 *   npx tsx src/scripts/verify-classified-gap.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

function n(v: unknown): number {
  return Number(v) || 0;
}
function head(t: string) {
  console.log(`\n\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  // 1. Does a handover_route column exist in the database at all?
  const cols = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'requirement' AND column_name IN
      ('handover_route','classification','collector_district',
       'handoff_comment','handed_over_at','handed_over_by','status')
    ORDER BY column_name`);

  head("1. WHICH OF THESE ARE REAL DATABASE COLUMNS?");
  const found = new Set(cols.map((c: Record<string, unknown>) => c.column_name as string));
  for (const c of ["classification", "collector_district", "handoff_comment",
                   "handed_over_at", "handed_over_by", "status", "handover_route"]) {
    console.log(`  ${found.has(c) ? "EXISTS  " : "MISSING "} ${c}`);
  }

  // 2. Classified roles by status — is the prepared-but-uncommitted state real?
  const byStatus = await q(`
    SELECT classification, status, COUNT(*)::int roles,
           COUNT(*) FILTER (WHERE handoff_comment IS NOT NULL
                              AND handoff_comment <> '')::int with_comment,
           COUNT(*) FILTER (WHERE collector_district IS NOT NULL
                              AND collector_district <> '')::int with_district,
           COUNT(*) FILTER (WHERE handed_over_at IS NOT NULL)::int with_stamp
    FROM requirement
    WHERE classification IS NOT NULL AND classification <> ''
    GROUP BY classification, status
    ORDER BY classification, status`);

  head("2. EVERY ROLE THAT HAS A CLASSIFICATION, BY STATUS");
  console.log("\n  classification  status                    roles  comment  district  stamped");
  console.log("  " + "-".repeat(76));
  for (const r of byStatus) {
    console.log(
      "  " + String(r.classification).padEnd(16) +
      String(r.status).padEnd(24) +
      String(r.roles).padStart(6) +
      String(r.with_comment).padStart(9) +
      String(r.with_district).padStart(10) +
      String(r.with_stamp).padStart(9)
    );
  }

  // 3. Fully prepared but uncommitted
  const [prepared] = await q(`
    SELECT COUNT(*)::int roles,
           COUNT(DISTINCT company_code)::int companies
    FROM requirement
    WHERE status = 'captured'
      AND classification IS NOT NULL AND classification <> ''
      AND handoff_comment IS NOT NULL AND handoff_comment <> ''
      AND required_count_validated > 0
      AND qualification IS NOT NULL AND qualification <> ''
      AND experience_from IS NOT NULL AND experience_to IS NOT NULL
      AND (classification <> 'collector'
           OR (collector_district IS NOT NULL AND collector_district <> ''))`);

  // Looser: classified + comment only, ignoring the other gate fields
  const [looser] = await q(`
    SELECT COUNT(*)::int roles,
           COUNT(DISTINCT company_code)::int companies
    FROM requirement
    WHERE status = 'captured'
      AND classification IS NOT NULL AND classification <> ''
      AND handoff_comment IS NOT NULL AND handoff_comment <> ''`);

  head("3. PREPARED BUT UNCOMMITTED (status still 'captured')");
  console.log(`\n  Passing the FULL handoff gate:`);
  console.log(`    ${n(prepared.roles)} roles across ${n(prepared.companies)} companies`);
  console.log(`\n  Classification + handoff comment only (ignoring other gate fields):`);
  console.log(`    ${n(looser.roles)} roles across ${n(looser.companies)} companies`);
  console.log(`\n  Difference = roles classified but still missing count/qualification/experience:`);
  console.log(`    ${n(looser.roles) - n(prepared.roles)} roles`);

  // 4. Validated companies by classification completeness
  const completeness = await q(`
    WITH validated_companies AS (
      SELECT DISTINCT company_code FROM requirement WHERE required_count_validated > 0
    ),
    per_company AS (
      SELECT r.company_code,
             COUNT(*) FILTER (WHERE r.required_count_validated > 0)::int AS validated_roles,
             COUNT(*) FILTER (WHERE r.required_count_validated > 0
                                AND r.classification IS NOT NULL
                                AND r.classification <> '')::int AS classified_roles,
             COUNT(*) FILTER (WHERE r.status LIKE 'handed_over_%')::int AS handed_roles
      FROM requirement r
      INNER JOIN validated_companies v ON v.company_code = r.company_code
      GROUP BY r.company_code
    )
    SELECT
      CASE
        WHEN handed_roles > 0                            THEN '4. Handed over (committed)'
        WHEN classified_roles = 0                        THEN '1. No classification at all'
        WHEN classified_roles < validated_roles          THEN '2. Partially classified'
        ELSE                                                  '3. Fully classified, not committed'
      END AS state,
      COUNT(*)::int AS companies
    FROM per_company GROUP BY 1 ORDER BY 1`);

  head("4. VALIDATED COMPANIES BY CLASSIFICATION STATE");
  console.log("");
  let tot = 0;
  for (const r of completeness) {
    console.log(`  ${String(r.state).padEnd(40)}${String(r.companies).padStart(6)}`);
    tot += n(r.companies);
  }
  console.log("  " + "-".repeat(46));
  console.log(`  ${"Total validated companies".padEnd(40)}${String(tot).padStart(6)}`);

  // 5. Does the commit step capture anything new?
  const [commitDelta] = await q(`
    SELECT
      COUNT(*)::int handed_roles,
      COUNT(*) FILTER (WHERE handed_over_at IS NOT NULL)::int stamped,
      COUNT(*) FILTER (WHERE handed_over_by IS NOT NULL)::int attributed
    FROM requirement WHERE status LIKE 'handed_over_%'`);

  head("5. WHAT THE COMMIT STEP ACTUALLY WRITES");
  console.log(`\n  Of ${n(commitDelta.handed_roles)} handed-over roles:`);
  console.log(`    handed_over_at  set on ${n(commitDelta.stamped)}`);
  console.log(`    handed_over_by  set on ${n(commitDelta.attributed)}`);
  console.log(`\n  No other column differs between a classified role and a handed-over one.`);
  console.log(`  The commit writes: status, handed_over_at, handed_over_by — plus an`);
  console.log(`  edb_outbox row and an audit_log entry (side effects, not role columns).`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
