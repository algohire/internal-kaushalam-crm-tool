/**
 * Is partial progress a real, valid state? A company may have 5 roles on EDB
 * and confirm only 1 — that single validated role is legitimate demand.
 *
 * This checks how common partial states are, and — more importantly — what
 * happened to the roles that were NOT validated at those companies.
 *
 *   npx tsx src/scripts/partial-analysis.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

function n(v: unknown): number {
  return Number(v) || 0;
}
function head(t: string) {
  console.log(`\n\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);
}
function bar(x: number, total: number, w = 22): string {
  const f = total > 0 ? Math.round((x / total) * w) : 0;
  return "█".repeat(f) + "░".repeat(Math.max(w - f, 0));
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  // ── 1. Validated companies: full vs partial validation ──
  const validationShape = await q(`
    WITH per_company AS (
      SELECT company_code,
             COUNT(*)::int AS roles_total,
             COUNT(*) FILTER (WHERE required_count_validated > 0)::int AS validated,
             COUNT(*) FILTER (WHERE status = 'no_requirement')::int AS closed
      FROM requirement GROUP BY company_code
    )
    SELECT
      CASE
        WHEN validated = roles_total              THEN '1. All roles validated'
        WHEN validated + closed = roles_total     THEN '2. Partial — rest explicitly closed'
        ELSE                                           '3. Partial — rest left untouched'
      END AS shape,
      COUNT(*)::int AS companies,
      SUM(roles_total)::int AS roles,
      SUM(validated)::int AS roles_validated,
      SUM(closed)::int AS roles_closed
    FROM per_company WHERE validated > 0
    GROUP BY 1 ORDER BY 1`);

  const totalValidatedCos = validationShape.reduce(
    (s: number, r: Record<string, unknown>) => s + n(r.companies), 0);

  head("1. VALIDATED COMPANIES — HOW COMPLETE IS THE VALIDATION?");
  console.log("\n  Shape                                 Companies  Roles  Valid  Closed");
  console.log("  " + "-".repeat(74));
  for (const r of validationShape) {
    console.log(
      "  " + String(r.shape).padEnd(38) +
      String(r.companies).padStart(8) +
      String(r.roles).padStart(7) +
      String(r.roles_validated).padStart(7) +
      String(r.roles_closed).padStart(8) +
      "  " + bar(n(r.companies), totalValidatedCos, 14)
    );
  }
  console.log("  " + "-".repeat(74));
  console.log(`  ${"Total validated companies".padEnd(38)}${String(totalValidatedCos).padStart(8)}`);

  // ── 2. The ambiguous bucket: untouched roles at validated companies ──
  const [ambiguous] = await q(`
    WITH validated_companies AS (
      SELECT DISTINCT company_code FROM requirement WHERE required_count_validated > 0
    )
    SELECT
      COUNT(*)::int AS untouched_roles,
      COUNT(DISTINCT r.company_code)::int AS companies,
      COALESCE(SUM(r.required_count),0)::int AS openings_in_limbo
    FROM requirement r
    INNER JOIN validated_companies v ON v.company_code = r.company_code
    WHERE (r.required_count_validated IS NULL OR r.required_count_validated = 0)
      AND r.status = 'captured'`);

  head("2. THE AMBIGUOUS ROLES");
  console.log(`\n  At companies that HAVE validated something, these roles were neither`);
  console.log(`  validated nor explicitly closed:\n`);
  console.log(`    ${n(ambiguous.untouched_roles)} roles`);
  console.log(`    across ${n(ambiguous.companies)} companies`);
  console.log(`    carrying ${n(ambiguous.openings_in_limbo).toLocaleString("en-IN")} openings on EDB`);
  console.log(`\n  These are indistinguishable in the data between:`);
  console.log(`    "the employer does not need this role"  (should be no_requirement)`);
  console.log(`    "the caller did not get to it"          (real outstanding work)`);

  // ── 3. Handover: partial vs complete ──
  const handoverShape = await q(`
    WITH per_company AS (
      SELECT company_code,
             COUNT(*) FILTER (WHERE required_count_validated > 0)::int AS validated,
             COUNT(*) FILTER (WHERE status LIKE 'handed_over_%')::int AS handed
      FROM requirement GROUP BY company_code
    )
    SELECT
      CASE
        WHEN handed = 0                 THEN '1. Nothing handed over'
        WHEN handed < validated         THEN '2. Partial — some roles routed'
        ELSE                                 '3. All validated roles routed'
      END AS shape,
      COUNT(*)::int AS companies,
      SUM(validated)::int AS validated_roles,
      SUM(handed)::int AS handed_roles
    FROM per_company WHERE validated > 0
    GROUP BY 1 ORDER BY 1`);

  head("3. HANDOVER — PARTIAL VS COMPLETE");
  console.log("\n  Shape                              Companies  ValidRoles  HandedRoles");
  console.log("  " + "-".repeat(74));
  for (const r of handoverShape) {
    console.log(
      "  " + String(r.shape).padEnd(35) +
      String(r.companies).padStart(8) +
      String(r.validated_roles).padStart(12) +
      String(r.handed_roles).padStart(13)
    );
  }

  // ── 4. Worked examples of the partial pattern ──
  const examples = await q(`
    WITH per_company AS (
      SELECT r.company_code,
             MAX(c.company_name) AS company_name,
             COUNT(*)::int AS roles_total,
             COUNT(*) FILTER (WHERE r.required_count_validated > 0)::int AS validated,
             COUNT(*) FILTER (WHERE r.status = 'no_requirement')::int AS closed,
             COUNT(*) FILTER (WHERE r.status LIKE 'handed_over_%')::int AS handed,
             COALESCE(SUM(r.required_count_validated),0)::int AS openings
      FROM requirement r
      INNER JOIN company c ON c.company_code = r.company_code
      GROUP BY r.company_code
    )
    SELECT * FROM per_company
    WHERE validated > 0 AND validated < roles_total
    ORDER BY roles_total DESC, openings DESC LIMIT 12`);

  head("4. WORKED EXAMPLES — COMPANIES WITH PARTIAL VALIDATION");
  console.log("\n  Company                                   Roles  Valid  Closed  Handed  Openings");
  console.log("  " + "-".repeat(76));
  for (const r of examples) {
    const name = String(r.company_name ?? "").slice(0, 38);
    console.log(
      "  " + name.padEnd(40) +
      String(r.roles_total).padStart(6) +
      String(r.validated).padStart(7) +
      String(r.closed).padStart(8) +
      String(r.handed).padStart(8) +
      String(r.openings).padStart(10)
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
