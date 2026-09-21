/**
 * Exhaustive end-to-end account of every role in the system.
 * Each role lands in exactly one bucket — buckets sum to the total.
 *
 *   npx tsx src/scripts/role-lifecycle.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

function n(v: unknown): number {
  return Number(v) || 0;
}
function f(v: unknown): string {
  return n(v).toLocaleString("en-IN");
}
function head(t: string) {
  console.log(`\n${"═".repeat(88)}\n${t}\n${"═".repeat(88)}`);
}
function bar(x: number, total: number, w = 20): string {
  const k = total > 0 ? Math.round((x / total) * w) : 0;
  return "█".repeat(k) + "░".repeat(Math.max(w - k, 0));
}

const VALID = `required_count_validated > 0`;
const ROUTED = `classification IS NOT NULL AND classification <> ''`;
const DISPATCHED = `status LIKE 'handed_over_%'`;

// NOT (col > 0) evaluates to NULL when col IS NULL, which a FILTER clause
// treats as false. Negations must be written explicitly or rows vanish.
const NOT_VALID = `(required_count_validated IS NULL OR required_count_validated = 0)`;
const NOT_ROUTED = `(classification IS NULL OR classification = '')`;

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  const [tot] = await q(
    `SELECT COUNT(*)::int roles, COALESCE(SUM(required_count),0)::int openings FROM requirement`
  );
  const TOTAL = n(tot.roles);

  // ── 1. Raw status distribution ──
  const statuses = await q(`
    SELECT status,
           COUNT(*)::int roles,
           COUNT(DISTINCT company_code)::int companies,
           COALESCE(SUM(required_count),0)::int openings_edb,
           COALESCE(SUM(required_count_validated),0)::int openings_validated
    FROM requirement GROUP BY status ORDER BY COUNT(*) DESC`);

  head("1. RAW status COLUMN — WHAT IS STORED");
  console.log("\n  status                     Roles  Companies  OpenEDB  OpenValid  Share");
  console.log("  " + "-".repeat(80));
  for (const r of statuses) {
    console.log(
      "  " + String(r.status).padEnd(24) +
      f(r.roles).padStart(7) +
      f(r.companies).padStart(11) +
      f(r.openings_edb).padStart(9) +
      f(r.openings_validated).padStart(11) +
      "  " + bar(n(r.roles), TOTAL, 14)
    );
  }
  console.log("  " + "-".repeat(80));
  console.log("  " + "TOTAL".padEnd(24) + f(TOTAL).padStart(7) + "".padStart(11) + f(tot.openings).padStart(9));

  // ── 2. Exhaustive lifecycle buckets — mutually exclusive ──
  const [b] = await q(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'captured'
        AND ${NOT_VALID} AND ${NOT_ROUTED})::int                           AS untouched,
      COALESCE(SUM(required_count) FILTER (WHERE status = 'captured'
        AND ${NOT_VALID} AND ${NOT_ROUTED}),0)::int                        AS untouched_open,

      COUNT(*) FILTER (WHERE status = 'captured'
        AND ${VALID} AND ${NOT_ROUTED})::int                               AS valid_only,
      COALESCE(SUM(required_count_validated) FILTER (WHERE status = 'captured'
        AND ${VALID} AND ${NOT_ROUTED}),0)::int                            AS valid_only_open,

      COUNT(*) FILTER (WHERE status = 'captured'
        AND ${VALID} AND ${ROUTED})::int                                   AS routed_undispatched,
      COALESCE(SUM(required_count_validated) FILTER (WHERE status = 'captured'
        AND ${VALID} AND ${ROUTED}),0)::int                                AS routed_undispatched_open,

      COUNT(*) FILTER (WHERE status = 'captured'
        AND ${NOT_VALID} AND ${ROUTED})::int                               AS routed_nocount,

      COUNT(*) FILTER (WHERE ${DISPATCHED})::int                           AS dispatched,
      COALESCE(SUM(required_count_validated) FILTER
        (WHERE ${DISPATCHED}),0)::int                                      AS dispatched_open,

      COUNT(*) FILTER (WHERE status = 'no_requirement')::int               AS closed,
      COALESCE(SUM(required_count) FILTER
        (WHERE status = 'no_requirement'),0)::int                          AS closed_open,

      COUNT(*) FILTER (WHERE status NOT IN ('captured','no_requirement')
        AND NOT (${DISPATCHED}))::int                                      AS other_status
    FROM requirement`);

  const buckets: [string, number, number, string][] = [
    ["A. Never touched", n(b.untouched), n(b.untouched_open),
      "no count, no route — caller has not reached this role"],
    ["B. Validated, no route", n(b.valid_only), n(b.valid_only_open),
      "employer confirmed a count; route not yet decided"],
    ["C. Routed, not dispatched", n(b.routed_undispatched), n(b.routed_undispatched_open),
      "route decided; downstream team cannot see it"],
    ["D. Routed, no count", n(b.routed_nocount), 0,
      "route set but vacancy count missing — cannot dispatch"],
    ["E. Dispatched", n(b.dispatched), n(b.dispatched_open),
      "live with the receiving team"],
    ["F. Closed — not required", n(b.closed), n(b.closed_open),
      "employer said this role is not needed"],
    ["G. Other status", n(b.other_status), 0,
      "future / not_operational / do_not_call / duplicate"],
  ];

  head("2. EXHAUSTIVE LIFECYCLE — EVERY ROLE IN EXACTLY ONE BUCKET");
  console.log("\n  Bucket                        Roles   Openings  Share");
  console.log("  " + "-".repeat(84));
  let sum = 0;
  for (const [label, roles, open] of buckets) {
    sum += roles;
    console.log(
      "  " + label.padEnd(28) + f(roles).padStart(7) + f(open).padStart(11) +
      "  " + bar(roles, TOTAL, 16) + ` ${Math.round((roles / TOTAL) * 100)}%`
    );
  }
  console.log("  " + "-".repeat(84));
  console.log("  " + "SUM".padEnd(28) + f(sum).padStart(7));
  console.log("  " + "TOTAL ROLES".padEnd(28) + f(TOTAL).padStart(7) +
    (sum === TOTAL ? "   <- reconciles" : `   <- MISMATCH of ${TOTAL - sum}`));

  console.log("\n  What each bucket means:");
  for (const [label, , , meaning] of buckets) {
    console.log(`    ${label.padEnd(28)} ${meaning}`);
  }

  // ── 3. Needed vs not needed ──
  const needed = n(b.valid_only) + n(b.routed_undispatched) + n(b.dispatched) + n(b.routed_nocount);
  const notNeeded = n(b.closed) + n(b.other_status);
  const unknown = n(b.untouched);

  head("3. NEEDED / NOT NEEDED / UNKNOWN");
  console.log("\n  Verdict                        Roles   Share   Basis");
  console.log("  " + "-".repeat(84));
  console.log(`  NEEDED — employer confirmed    ${f(needed).padStart(6)}  ${String(Math.round((needed / TOTAL) * 100) + "%").padStart(5)}   buckets B + C + D + E`);
  console.log(`  NOT NEEDED — employer declined ${f(notNeeded).padStart(6)}  ${String(Math.round((notNeeded / TOTAL) * 100) + "%").padStart(5)}   buckets F + G`);
  console.log(`  UNKNOWN — never asked          ${f(unknown).padStart(6)}  ${String(Math.round((unknown / TOTAL) * 100) + "%").padStart(5)}   bucket A`);
  console.log("  " + "-".repeat(84));
  console.log(`  TOTAL                          ${f(TOTAL).padStart(6)}`);

  // ── 4. Of roles actually asked about, hit rate ──
  const asked = needed + notNeeded;
  console.log(`\n  Of the ${f(asked)} roles an employer was actually asked about:`);
  console.log(`    needed     ${f(needed).padStart(6)}  ${Math.round((needed / asked) * 100)}%`);
  console.log(`    not needed ${f(notNeeded).padStart(6)}  ${Math.round((notNeeded / asked) * 100)}%`);

  // ── 5. Closed roles — where did they come from ──
  const closedByTier = await q(`
    SELECT c.tier,
           COUNT(*)::int roles,
           COUNT(DISTINCT r.company_code)::int companies,
           COALESCE(SUM(r.required_count),0)::int openings
    FROM requirement r INNER JOIN company c ON c.company_code = r.company_code
    WHERE r.status = 'no_requirement'
    GROUP BY c.tier ORDER BY c.tier NULLS LAST`);

  head("4. CLOSED ROLES (not required) BY TIER");
  console.log("\n  Tier    Roles  Companies  OpeningsEDB");
  console.log("  " + "-".repeat(46));
  for (const r of closedByTier) {
    console.log(
      "  " + (r.tier === null ? "none" : `T${r.tier}`).padEnd(6) +
      f(r.roles).padStart(7) + f(r.companies).padStart(11) + f(r.openings).padStart(13)
    );
  }

  // ── 6. Route breakdown of live roles ──
  const routes = await q(`
    SELECT classification,
           COUNT(*)::int roles,
           COUNT(*) FILTER (WHERE ${DISPATCHED})::int dispatched,
           COUNT(*) FILTER (WHERE NOT (${DISPATCHED}))::int undispatched,
           COALESCE(SUM(required_count_validated),0)::int openings
    FROM requirement WHERE ${ROUTED}
    GROUP BY classification ORDER BY COUNT(*) DESC`);

  head("5. LIVE ROLES BY ROUTE — DISPATCH STATE");
  console.log("\n  Route        Roles  Dispatched  Waiting  Openings");
  console.log("  " + "-".repeat(58));
  for (const r of routes) {
    console.log(
      "  " + String(r.classification).padEnd(12) +
      f(r.roles).padStart(6) + f(r.dispatched).padStart(12) +
      f(r.undispatched).padStart(9) + f(r.openings).padStart(10)
    );
  }

  // ── 7. Untouched roles by tier — the remaining work ──
  const untouchedByTier = await q(`
    SELECT c.tier,
           COUNT(*)::int roles,
           COUNT(DISTINCT r.company_code)::int companies,
           COALESCE(SUM(r.required_count),0)::int openings
    FROM requirement r INNER JOIN company c ON c.company_code = r.company_code
    WHERE r.status = 'captured'
      AND ${NOT_VALID} AND ${NOT_ROUTED}
    GROUP BY c.tier ORDER BY c.tier NULLS LAST`);

  head("6. NEVER-TOUCHED ROLES BY TIER — THE REMAINING WORK");
  console.log("\n  Tier    Roles  Companies  OpeningsEDB");
  console.log("  " + "-".repeat(46));
  for (const r of untouchedByTier) {
    console.log(
      "  " + (r.tier === null ? "none" : `T${r.tier}`).padEnd(6) +
      f(r.roles).padStart(7) + f(r.companies).padStart(11) + f(r.openings).padStart(13)
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
