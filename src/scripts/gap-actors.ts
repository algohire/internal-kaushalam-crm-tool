/**
 * Who touched the gap companies — validated but never routed.
 *
 *   npx tsx src/scripts/gap-actors.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

function head(t: string) {
  console.log(`\n${"═".repeat(86)}\n${t}\n${"═".repeat(86)}`);
}

const VALID = `required_count_validated > 0`;
const ROUTED = `classification IS NOT NULL AND classification <> ''`;

const GAP_COMPANIES = `
  SELECT DISTINCT company_code FROM requirement WHERE ${VALID}
  EXCEPT
  SELECT DISTINCT company_code FROM requirement WHERE ${ROUTED}`;

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const q = (t: string) => sql.query(t);

  // ── Who validated the gap roles ──
  const byUser = await q(`
    WITH gap AS (${GAP_COMPANIES})
    SELECT COALESCE(r.updated_by,'(none)') AS actor,
           COUNT(*)::int roles,
           COUNT(DISTINCT r.company_code)::int companies,
           COALESCE(SUM(r.required_count_validated),0)::int openings
    FROM requirement r
    INNER JOIN gap g ON g.company_code = r.company_code
    WHERE ${VALID}
    GROUP BY 1 ORDER BY COUNT(*) DESC`);

  head("WHO VALIDATED GAP ROLES BUT DID NOT ROUTE THEM");
  console.log("\n  Actor                    Roles  Companies  Openings");
  console.log("  " + "-".repeat(56));
  for (const r of byUser) {
    console.log(
      "  " + String(r.actor).padEnd(24) +
      String(r.roles).padStart(6) +
      String(r.companies).padStart(11) +
      String(r.openings).padStart(10)
    );
  }

  // ── Every call logged against gap companies ──
  const calls = await q(`
    WITH gap AS (${GAP_COMPANIES})
    SELECT c.company_name, i.username, i.disposition, i.channel,
           i.created_at, i.next_step, i.next_action_date
    FROM interaction i
    INNER JOIN gap g ON g.company_code = i.company_code
    INNER JOIN company c ON c.company_code = i.company_code
    ORDER BY c.company_name, i.created_at`);

  head("CALL HISTORY ON GAP COMPANIES");
  console.log("\n  Company                        Actor        Disposition     When        Next step");
  console.log("  " + "-".repeat(110));
  for (const r of calls) {
    const when = r.created_at
      ? new Date(String(r.created_at)).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })
      : "";
    console.log(
      "  " + String(r.company_name ?? "").slice(0, 28).padEnd(30) +
      String(r.username ?? "").padEnd(13) +
      String(r.disposition ?? "").padEnd(16) +
      when.padEnd(12) +
      String(r.next_step ?? "").slice(0, 40)
    );
  }

  // ── Audit trail ──
  const audit = await q(`
    WITH gap AS (${GAP_COMPANIES})
    SELECT a.username, a.action, COUNT(*)::int events
    FROM audit_log a
    INNER JOIN gap g ON g.company_code = a.object_id
    GROUP BY 1,2 ORDER BY COUNT(*) DESC`);

  head("AUDIT TRAIL ON GAP COMPANIES");
  if (audit.length === 0) {
    console.log("\n  No audit rows keyed to these company codes.");
  } else {
    console.log("\n  Actor                 Action                Events");
    console.log("  " + "-".repeat(52));
    for (const r of audit) {
      console.log(
        "  " + String(r.username ?? "").padEnd(22) +
        String(r.action ?? "").padEnd(22) +
        String(r.events).padStart(6)
      );
    }
  }

  // ── Same actors: what they DID route, for contrast ──
  const contrast = await q(`
    SELECT COALESCE(updated_by,'(none)') AS actor,
           COUNT(*) FILTER (WHERE ${ROUTED})::int routed,
           COUNT(*) FILTER (WHERE ${VALID} AND NOT (${ROUTED}))::int not_routed,
           COUNT(*) FILTER (WHERE status LIKE 'handed_over_%')::int dispatched
    FROM requirement
    WHERE ${VALID} OR ${ROUTED}
    GROUP BY 1 ORDER BY COUNT(*) DESC`);

  head("PER ACTOR — ROUTED vs NOT ROUTED vs DISPATCHED (all their work)");
  console.log("\n  Actor                    Routed  NotRouted  Dispatched  RouteRate");
  console.log("  " + "-".repeat(66));
  for (const r of contrast) {
    const routed = Number(r.routed) || 0;
    const notRouted = Number(r.not_routed) || 0;
    const denom = routed + notRouted;
    const rate = denom > 0 ? `${Math.round((routed / denom) * 100)}%` : "-";
    console.log(
      "  " + String(r.actor).padEnd(24) +
      String(routed).padStart(7) +
      String(notRouted).padStart(11) +
      String(r.dispatched).padStart(12) +
      rate.padStart(11)
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
