/**
 * Explains the two drop-offs in the funnel, from data rather than assumption:
 *   Connected (756) -> Validated (208)   gap 548
 *   Validated (208) -> Handed over (70)  gap 138
 *
 *   npx tsx src/scripts/gap-analysis.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

const CONNECTED =
  "('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')";

function n(v: unknown): number {
  return Number(v) || 0;
}
function bar(x: number, total: number, width = 28): string {
  const filled = total > 0 ? Math.round((x / total) * width) : 0;
  return "█".repeat(filled) + "░".repeat(Math.max(width - filled, 0));
}
function head(t: string) {
  console.log(`\n\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  // ───────────── GAP 1: Connected -> Validated ─────────────
  // Classify every connected company by the best outcome it ever reached.
  const outcomeMix = await q(`
    WITH per_company AS (
      SELECT company_code,
             BOOL_OR(disposition = 'hiring_now')      AS hiring_now,
             BOOL_OR(disposition = 'hiring_later')    AS hiring_later,
             BOOL_OR(disposition = 'no_requirement')  AS no_requirement,
             BOOL_OR(disposition = 'do_not_call')     AS do_not_call,
             BOOL_OR(disposition = 'not_operational') AS not_operational
      FROM interaction
      WHERE disposition IN ${CONNECTED}
      GROUP BY company_code
    )
    SELECT
      CASE
        WHEN hiring_now       THEN '1. Hiring now — VALIDATED'
        WHEN hiring_later     THEN '2. Hiring later — future demand'
        WHEN no_requirement   THEN '3. No requirement'
        WHEN do_not_call      THEN '4. Do not call'
        WHEN not_operational  THEN '5. Not operational / closed'
        ELSE '6. Other'
      END AS outcome,
      COUNT(*)::int AS companies
    FROM per_company
    GROUP BY 1 ORDER BY 1`);

  const totalConnected = outcomeMix.reduce(
    (s: number, r: Record<string, unknown>) => s + n(r.companies), 0);

  head("GAP 1 — CONNECTED (756) to VALIDATED (208)");
  console.log("\nEvery company that was reached, by the best outcome it ever gave:\n");
  console.log("  Outcome                            Companies   Share");
  console.log("  " + "-".repeat(72));
  for (const r of outcomeMix) {
    const c = n(r.companies);
    console.log(
      `  ${String(r.outcome).padEnd(34)}${String(c).padStart(8)}  ${String(Math.round((c / totalConnected) * 100) + "%").padStart(5)}  ${bar(c, totalConnected)}`
    );
  }
  console.log("  " + "-".repeat(72));
  console.log(`  ${"Total connected".padEnd(34)}${String(totalConnected).padStart(8)}   100%`);

  // ───────────── GAP 2: Validated -> Handed over ─────────────
  // Validated companies (hiring_now) that have not been routed anywhere.
  const [stalled] = await q(`
    SELECT COUNT(*)::int c FROM (
      SELECT DISTINCT company_code FROM interaction WHERE disposition = 'hiring_now'
      EXCEPT
      SELECT DISTINCT company_code FROM requirement WHERE status LIKE 'handed_over_%'
    ) s`);

  // Of their roles, which handoff-gate fields are missing?
  const [gate] = await q(`
    WITH stalled_companies AS (
      SELECT DISTINCT company_code FROM interaction WHERE disposition = 'hiring_now'
      EXCEPT
      SELECT DISTINCT company_code FROM requirement WHERE status LIKE 'handed_over_%'
    )
    SELECT
      COUNT(*)::int AS roles_total,
      COUNT(*) FILTER (WHERE r.required_count_validated IS NULL
                          OR r.required_count_validated = 0)::int AS no_count,
      COUNT(*) FILTER (WHERE r.qualification IS NULL
                          OR r.qualification = '')::int            AS no_qualification,
      COUNT(*) FILTER (WHERE r.experience_from IS NULL
                          OR r.experience_to IS NULL)::int         AS no_experience,
      COUNT(*) FILTER (WHERE r.classification IS NULL
                          OR r.classification = '')::int           AS no_classification,
      COUNT(*) FILTER (WHERE r.handoff_comment IS NULL
                          OR r.handoff_comment = '')::int          AS no_handoff_comment,
      COUNT(*) FILTER (WHERE r.status = 'no_requirement')::int     AS closed_roles
    FROM requirement r
    INNER JOIN stalled_companies s ON s.company_code = r.company_code`);

  // How far along is each stalled company?
  const progress = await q(`
    WITH stalled_companies AS (
      SELECT DISTINCT company_code FROM interaction WHERE disposition = 'hiring_now'
      EXCEPT
      SELECT DISTINCT company_code FROM requirement WHERE status LIKE 'handed_over_%'
    ),
    per_company AS (
      SELECT r.company_code,
             COUNT(*)::int AS roles,
             COUNT(*) FILTER (WHERE r.required_count_validated > 0)::int AS with_count,
             COUNT(*) FILTER (WHERE r.classification IS NOT NULL
                                AND r.classification <> '')::int         AS with_class
      FROM requirement r
      INNER JOIN stalled_companies s ON s.company_code = r.company_code
      GROUP BY r.company_code
    )
    SELECT
      CASE
        WHEN with_count = 0                    THEN 'A. No role has a vacancy count yet'
        WHEN with_class = 0                    THEN 'B. Counts entered, none classified'
        WHEN with_class < with_count           THEN 'C. Partly classified'
        ELSE                                        'D. Classified — handoff not completed'
      END AS stage,
      COUNT(*)::int AS companies
    FROM per_company GROUP BY 1 ORDER BY 1`);

  // Companies with no reachable mobile — a hard gate blocker
  const [noMobile] = await q(`
    WITH stalled_companies AS (
      SELECT DISTINCT company_code FROM interaction WHERE disposition = 'hiring_now'
      EXCEPT
      SELECT DISTINCT company_code FROM requirement WHERE status LIKE 'handed_over_%'
    )
    SELECT COUNT(*)::int c FROM stalled_companies s
    WHERE NOT EXISTS (
      SELECT 1 FROM contact ct
      WHERE ct.company_code = s.company_code
        AND ct.valid = true AND ct.mobile IS NOT NULL AND LENGTH(ct.mobile) = 10)`);

  head("GAP 2 — VALIDATED (208) to HANDED OVER (70)");
  console.log(`\n${n(stalled.c)} validated companies have not been routed to any channel.`);
  console.log(`Between them they hold ${n(gate.roles_total)} roles.\n`);

  console.log("How far each stalled company has progressed:\n");
  console.log("  Stage                                    Companies   Share");
  console.log("  " + "-".repeat(74));
  for (const r of progress) {
    const c = n(r.companies);
    console.log(
      `  ${String(r.stage).padEnd(40)}${String(c).padStart(8)}  ${String(Math.round((c / n(stalled.c)) * 100) + "%").padStart(5)}  ${bar(c, n(stalled.c), 20)}`
    );
  }

  console.log("\n\nWhich handoff-gate field is missing, across those roles:\n");
  const total = n(gate.roles_total);
  const fields: [string, number][] = [
    ["Vacancy count not entered", n(gate.no_count)],
    ["Qualification not selected", n(gate.no_qualification)],
    ["Experience range not set", n(gate.no_experience)],
    ["Classification not chosen", n(gate.no_classification)],
    ["Handoff comment not written", n(gate.no_handoff_comment)],
  ];
  console.log("  Missing field                    Roles   Share of roles");
  console.log("  " + "-".repeat(74));
  for (const [label, v] of fields) {
    console.log(
      `  ${label.padEnd(30)}${String(v).padStart(7)}  ${String(Math.round((v / total) * 100) + "%").padStart(6)}  ${bar(v, total, 22)}`
    );
  }
  console.log(`\n  ${n(gate.closed_roles)} of those roles were marked "not required any more".`);
  console.log(`  ${n(noMobile.c)} companies have no contact with a valid 10-digit mobile,`);
  console.log(`  which blocks the handoff gate outright regardless of the other fields.`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
