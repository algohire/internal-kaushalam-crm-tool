/**
 * Dispatches roles that already carry a route but were never pushed to the
 * receiving team's queue, because the old form needed a separate button press.
 *
 *   npx tsx src/scripts/backfill-dispatch.ts [--apply]
 *
 * The dispatch is recorded as happening NOW, not backdated: the role reaches
 * the queue today, and the route decision keeps its own date and caller in the
 * version history. Each role gets a new requirement_version row (so the event
 * is appended, never rewritten) and an audit_log row. No edb_outbox rows are
 * written — this is an internal correction, not a sync event.
 *
 * Skipped: roles closed as "no requirement" that still carry a route, and roles
 * with no validated count. Both need a caller, not a script.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";

const sql = neon(process.env.DATABASE_URL!);
const APPLY = process.argv.includes("--apply");
const now = new Date().toISOString();
const today = now.split("T")[0];
const DISPATCHED_BY = "system — bulk dispatch";

const STATUS_FOR: Record<string, string> = {
  kaushalam: "handed_over_scheduling",
  collector: "handed_over_collector",
  apssdc: "handed_over_apssdc",
};

const n = (v: unknown) => Number(v) || 0;

async function main() {
  const rows = (await sql.query(`
    SELECT r.id, r.company_code, c.company_name, c.tier,
           COALESCE(r.role_name_edited, r.role_name) AS role,
           r.classification, r.status, r.version,
           COALESCE(r.required_count_validated, 0)::int AS openings,
           r.updated_by, v.changed_at AS route_decided_at, v.changed_by AS route_decided_by
    FROM requirement r
    JOIN company c ON c.company_code = r.company_code
    LEFT JOIN LATERAL (
      SELECT v.changed_at, v.changed_by FROM requirement_version v
      WHERE v.requirement_id = r.id AND v.diff_json LIKE '%classification%'
      ORDER BY v.version ASC LIMIT 1) v ON true
    WHERE r.classification IS NOT NULL AND r.classification <> ''
      AND r.status NOT LIKE 'handed_over_%'
    ORDER BY c.tier, c.company_rank`)) as Record<string, unknown>[];

  const skipped = rows.filter((r) => r.status === "no_requirement" || n(r.openings) === 0);
  const todo = rows.filter((r) => !skipped.includes(r));
  const unknownRoute = todo.filter((r) => !STATUS_FOR[r.classification as string]);
  if (unknownRoute.length > 0) {
    throw new Error(`Unknown route on ${unknownRoute.length} roles: ` +
      [...new Set(unknownRoute.map((r) => r.classification))].join(", "));
  }

  const byRoute = new Map<string, { roles: number; companies: Set<string>; openings: number }>();
  for (const r of todo) {
    const k = r.classification as string;
    const g = byRoute.get(k) ?? { roles: 0, companies: new Set<string>(), openings: 0 };
    g.roles++; g.companies.add(r.company_code as string); g.openings += n(r.openings);
    byRoute.set(k, g);
  }

  console.log(`\n${rows.length} roles carry a route without being dispatched\n`);
  console.log("route       -> status                      roles companies openings");
  for (const [route, g] of byRoute) {
    console.log(`  ${route.padEnd(10)} -> ${STATUS_FOR[route].padEnd(24)} ${String(g.roles).padStart(5)} ` +
      `${String(g.companies.size).padStart(9)} ${String(g.openings).padStart(8)}`);
  }
  const companies = new Set(todo.map((r) => r.company_code));
  console.log(`\n  total to dispatch: ${todo.length} roles · ${companies.size} companies · ` +
    `${todo.reduce((s, r) => s + n(r.openings), 0)} openings`);

  if (skipped.length > 0) {
    console.log(`\n  skipped ${skipped.length} (need a caller, not a script):`);
    for (const r of skipped) {
      console.log(`    ${r.company_name} — ${r.role}: ` +
        (r.status === "no_requirement" ? "closed but still carries a route" : "route with no validated count"));
    }
  }

  const noHistory = todo.filter((r) => !r.route_decided_at).length;
  console.log(`\n  route-decision history: ${todo.length - noHistory} of ${todo.length} roles ` +
    `(${noHistory} predate version tracking)`);
  console.log(`  dispatch will be recorded as ${today} by "${DISPATCHED_BY}"`);

  const backup = `data/backup-dispatch-${today}.json`;
  writeFileSync(backup, JSON.stringify({ dispatchedAt: now, skipped, roles: todo }, null, 1));
  console.log(`\nbackup written: ${backup}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
    return;
  }

  const statements: ReturnType<typeof sql>[] = [];
  for (const r of todo) {
    const status = STATUS_FOR[r.classification as string];
    const version = n(r.version) + 1;
    statements.push(sql`UPDATE requirement SET status = ${status}, handed_over_at = ${now},
                          handed_over_by = ${DISPATCHED_BY}, version = ${version}, updated_at = ${now}
                        WHERE id = ${r.id} AND status NOT LIKE 'handed_over_%'`);
    // Appended as its own version so history reads "route decided then, dispatched now".
    statements.push(sql`INSERT INTO requirement_version (id, requirement_id, version, changed_at, changed_by,
                          diff_json, snapshot_json)
                        VALUES (${crypto.randomUUID()}, ${r.id}, ${version}, ${now}, ${DISPATCHED_BY},
                          ${JSON.stringify({
                            status: { from: r.status, to: status },
                            handedOverAt: { from: null, to: now },
                            handedOverBy: { from: null, to: DISPATCHED_BY },
                          })},
                          ${JSON.stringify({ ...r, status, handedOverAt: now, handedOverBy: DISPATCHED_BY, version })})`);
    statements.push(sql`INSERT INTO audit_log (id, user_id, username, action, object_type, object_id,
                          detail_json, created_at)
                        VALUES (${crypto.randomUUID()}, NULL, 'system', 'dispatch_backfill', 'requirement',
                          ${r.id}, ${JSON.stringify({
                            companyCode: r.company_code, role: r.role, route: r.classification,
                            from: r.status, to: status, backup,
                            routeDecidedAt: r.route_decided_at ?? null,
                            routeDecidedBy: r.route_decided_by ?? r.updated_by ?? null,
                          })}, ${now})`);
  }

  const SIZE = 60;
  for (let i = 0; i < statements.length; i += SIZE) {
    await sql.transaction(statements.slice(i, i + SIZE));
    process.stdout.write(`  committed ${Math.min(i + SIZE, statements.length)}/${statements.length}\r`);
  }
  console.log(`\nCOMMITTED ${todo.length} roles dispatched`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
