/**
 * Tier-wise company funnel (same definitions as the admin dashboard), then a
 * drop-off breakdown for one tier: aggregate reasons + up to 10 sample
 * companies at every stage transition. Read-only.
 *
 *   npx tsx src/scripts/tier-drop-analysis.ts [tier=1]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const q = (text: string, params: unknown[] = []) =>
  sql.query(text, params) as Promise<Record<string, unknown>[]>;

const CONNECTED = `('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')`;
const TIER = Number(process.argv[2] ?? 1);

const f = (v: unknown) => (Number(v) || 0).toLocaleString("en-IN");
const head = (t: string) => console.log(`\n${"═".repeat(90)}\n${t}\n${"═".repeat(90)}`);
const cut = (s: unknown, n = 110) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

async function main() {
  // ── 1. Tier funnel, exactly the dashboard query ──
  const funnel = await q(`
    SELECT c.tier,
      COUNT(DISTINCT c.company_code)::int  AS universe,
      COUNT(DISTINCT i.company_code)::int  AS attempted,
      COUNT(DISTINCT ic.company_code)::int AS connected,
      COUNT(DISTINCT rv.company_code)::int AS validated,
      COUNT(DISTINCT rc.company_code)::int AS handed_over
    FROM company c
    LEFT JOIN (SELECT DISTINCT company_code FROM interaction) i ON i.company_code = c.company_code
    LEFT JOIN (SELECT DISTINCT company_code FROM interaction WHERE disposition IN ${CONNECTED}) ic
      ON ic.company_code = c.company_code
    LEFT JOIN (SELECT DISTINCT company_code FROM requirement WHERE required_count_validated > 0) rv
      ON rv.company_code = c.company_code
    LEFT JOIN (SELECT DISTINCT company_code FROM requirement
               WHERE classification IS NOT NULL AND classification <> '') rc
      ON rc.company_code = c.company_code
    WHERE c.tier IS NOT NULL
    GROUP BY c.tier ORDER BY c.tier`);

  head("TIER FUNNEL (companies) — dashboard definitions");
  console.log("  tier   universe  attempted  connected  validated  handed_over");
  const tot = { universe: 0, attempted: 0, connected: 0, validated: 0, handed_over: 0 };
  for (const r of funnel) {
    const u = Number(r.universe);
    const pct = (k: string) => `${f(r[k])} (${u ? Math.round((Number(r[k]) / u) * 100) : 0}%)`;
    console.log(`  T${r.tier}  ${f(u).padStart(9)}  ${pct("attempted").padStart(10)}  ${pct("connected").padStart(10)}  ${pct("validated").padStart(10)}  ${pct("handed_over").padStart(11)}`);
    for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += Number(r[k]) || 0;
  }
  console.log(`  ALL ${f(tot.universe).padStart(9)}  ${f(tot.attempted).padStart(10)}  ${f(tot.connected).padStart(10)}  ${f(tot.validated).padStart(10)}  ${f(tot.handed_over).padStart(11)}`);

  // Per-company stage flags for the chosen tier
  const base = `
    WITH co AS (
      SELECT c.company_code, c.company_name, c.district, c.total_required, c.company_rank,
             c.first_seen_batch, c.bookmarked_by, c.last_disposition, c.last_contact_at,
             EXISTS (SELECT 1 FROM interaction i WHERE i.company_code = c.company_code) AS att,
             EXISTS (SELECT 1 FROM interaction i WHERE i.company_code = c.company_code
                     AND i.disposition IN ${CONNECTED}) AS con,
             EXISTS (SELECT 1 FROM requirement r WHERE r.company_code = c.company_code
                     AND r.required_count_validated > 0) AS val,
             EXISTS (SELECT 1 FROM requirement r WHERE r.company_code = c.company_code
                     AND r.classification IS NOT NULL AND r.classification <> '') AS ho
      FROM company c WHERE c.tier = $1
    )`;

  // ── STEP 1: universe → attempted ──
  head(`T${TIER} · STEP 1  UNIVERSE → ATTEMPTED   (never called)`);
  const s1agg = await q(`${base}
    SELECT
      COUNT(*)::int AS n,
      COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM contact k WHERE k.company_code = co.company_code
                         AND k.valid AND k.mobile IS NOT NULL AND k.mobile <> ''))::int AS no_mobile,
      COUNT(*) FILTER (WHERE co.first_seen_batch <> (SELECT id FROM import_batch ORDER BY imported_at LIMIT 1))::int AS new_batch,
      COUNT(*) FILTER (WHERE co.bookmarked_by IS NOT NULL)::int AS bookmarked,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM task t WHERE t.company_code = co.company_code AND t.status='open'))::int AS open_task,
      COALESCE(SUM(co.total_required),0)::int AS openings
    FROM co WHERE NOT co.att`, [TIER]);
  const a1 = s1agg[0];
  console.log(`  not attempted            ${f(a1.n)}   (EDB openings sitting there: ${f(a1.openings)})`);
  console.log(`    no valid mobile on file ${f(a1.no_mobile)}`);
  console.log(`    arrived in later batch  ${f(a1.new_batch)}`);
  console.log(`    bookmarked by a caller  ${f(a1.bookmarked)}`);
  console.log(`    has an open task        ${f(a1.open_task)}`);
  const s1 = await q(`${base}
    SELECT co.company_rank, co.company_name, co.district, co.total_required,
      (SELECT COUNT(*) FROM contact k WHERE k.company_code = co.company_code AND k.valid AND k.mobile <> '')::int AS mobiles,
      (SELECT COUNT(*) FROM requirement r WHERE r.company_code = co.company_code)::int AS roles,
      (SELECT source_file FROM import_batch b WHERE b.id = co.first_seen_batch) AS batch,
      co.bookmarked_by
    FROM co WHERE NOT co.att ORDER BY co.company_rank LIMIT 10`, [TIER]);
  console.log("\n  sample (highest-ranked first)");
  for (const r of s1)
    console.log(`   #${String(r.company_rank).padEnd(4)} ${cut(r.company_name, 42).padEnd(42)} ${cut(r.district, 14).padEnd(14)} openings=${f(r.total_required).padEnd(5)} roles=${String(r.roles).padEnd(3)} mobiles=${r.mobiles}  batch=${cut(r.batch, 40)}${r.bookmarked_by ? "  ★bookmarked" : ""}`);

  // ── STEP 2: attempted → connected ──
  head(`T${TIER} · STEP 2  ATTEMPTED → CONNECTED   (called, never reached a decision-maker)`);
  const s2agg = await q(`${base}
    SELECT co.last_disposition AS d, COUNT(*)::int AS n,
      ROUND(AVG((SELECT COUNT(*) FROM interaction i WHERE i.company_code = co.company_code)),1) AS avg_calls
    FROM co WHERE co.att AND NOT co.con GROUP BY 1 ORDER BY 2 DESC`, [TIER]);
  console.log("  last disposition               companies   avg calls");
  for (const r of s2agg) console.log(`    ${String(r.d).padEnd(28)} ${f(r.n).padStart(8)}   ${r.avg_calls}`);
  const s2calls = await q(`${base}
    SELECT c.calls, COUNT(*)::int AS n FROM (
      SELECT (SELECT COUNT(*) FROM interaction i WHERE i.company_code = co.company_code)::int AS calls
      FROM co WHERE co.att AND NOT co.con) c GROUP BY 1 ORDER BY 1`, [TIER]);
  console.log("\n  calls made before giving up (distribution)");
  console.log("    " + s2calls.map((r) => `${r.calls} call${r.calls === 1 ? "" : "s"}: ${r.n}`).join("  ·  "));
  const s2 = await q(`${base}
    SELECT co.company_rank, co.company_name, co.total_required,
      (SELECT COUNT(*) FROM interaction i WHERE i.company_code = co.company_code)::int AS calls,
      (SELECT string_agg(i.disposition, ' > ' ORDER BY i.created_at) FROM interaction i WHERE i.company_code = co.company_code) AS trail,
      (SELECT i.comment FROM interaction i WHERE i.company_code = co.company_code ORDER BY i.created_at DESC LIMIT 1) AS last_comment,
      (SELECT i.username FROM interaction i WHERE i.company_code = co.company_code ORDER BY i.created_at DESC LIMIT 1) AS last_by,
      (SELECT i.created_at FROM interaction i WHERE i.company_code = co.company_code ORDER BY i.created_at DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM contact k WHERE k.company_code = co.company_code AND k.valid AND k.mobile <> '')::int AS mobiles
    FROM co WHERE co.att AND NOT co.con ORDER BY co.company_rank LIMIT 10`, [TIER]);
  console.log("\n  sample");
  for (const r of s2) {
    console.log(`   #${r.company_rank} ${cut(r.company_name, 50)}  openings=${f(r.total_required)}  calls=${r.calls}  valid mobiles=${r.mobiles}`);
    console.log(`       trail: ${r.trail}`);
    console.log(`       last:  ${String(r.last_at).slice(0, 10)} by ${r.last_by} — "${cut(r.last_comment)}"`);
  }

  // ── STEP 3: connected → validated ──
  head(`T${TIER} · STEP 3  CONNECTED → VALIDATED   (reached someone, no role confirmed with count > 0)`);
  const s3agg = await q(`${base}
    , best AS (
      SELECT co.company_code,
        (SELECT i.disposition FROM interaction i WHERE i.company_code = co.company_code
           AND i.disposition IN ${CONNECTED} ORDER BY i.created_at DESC LIMIT 1) AS d,
        (SELECT i.reason_code FROM interaction i WHERE i.company_code = co.company_code
           AND i.disposition IN ${CONNECTED} ORDER BY i.created_at DESC LIMIT 1) AS reason
      FROM co WHERE co.con AND NOT co.val)
    SELECT d, COALESCE(reason,'—') AS reason, COUNT(*)::int AS n FROM best GROUP BY 1,2 ORDER BY 3 DESC`, [TIER]);
  console.log("  latest connected disposition   reason                                   companies");
  for (const r of s3agg) console.log(`    ${String(r.d).padEnd(28)} ${cut(r.reason, 40).padEnd(40)} ${f(r.n).padStart(6)}`);
  const s3 = await q(`${base}
    SELECT co.company_rank, co.company_name, co.total_required,
      (SELECT string_agg(i.disposition, ' > ' ORDER BY i.created_at) FROM interaction i WHERE i.company_code = co.company_code) AS trail,
      (SELECT i.comment FROM interaction i WHERE i.company_code = co.company_code
         AND i.disposition IN ${CONNECTED} ORDER BY i.created_at DESC LIMIT 1) AS comment,
      (SELECT i.username FROM interaction i WHERE i.company_code = co.company_code
         AND i.disposition IN ${CONNECTED} ORDER BY i.created_at DESC LIMIT 1) AS by,
      (SELECT string_agg(s || ':' || n, ', ') FROM (SELECT r.status s, COUNT(*) n FROM requirement r
         WHERE r.company_code = co.company_code GROUP BY 1) x) AS role_status
    FROM co WHERE co.con AND NOT co.val ORDER BY co.company_rank LIMIT 10`, [TIER]);
  console.log("\n  sample");
  for (const r of s3) {
    console.log(`   #${r.company_rank} ${cut(r.company_name, 50)}  openings=${f(r.total_required)}  by ${r.by}`);
    console.log(`       trail: ${r.trail}`);
    console.log(`       roles: ${r.role_status}`);
    console.log(`       said:  "${cut(r.comment, 160)}"`);
  }

  // ── STEP 4: validated → handed over ──
  head(`T${TIER} · STEP 4  VALIDATED → HANDED OVER   (count confirmed, no route decided on any role)`);
  const s4 = await q(`${base}
    SELECT co.company_rank, co.company_name,
      (SELECT COUNT(*) FROM requirement r WHERE r.company_code = co.company_code AND r.required_count_validated > 0)::int AS val_roles,
      (SELECT SUM(r.required_count_validated) FROM requirement r WHERE r.company_code = co.company_code)::int AS val_openings,
      (SELECT string_agg(DISTINCT r.status, ', ') FROM requirement r WHERE r.company_code = co.company_code AND r.required_count_validated > 0) AS statuses,
      (SELECT string_agg(DISTINCT COALESCE(r.timing,'—'), ', ') FROM requirement r WHERE r.company_code = co.company_code AND r.required_count_validated > 0) AS timing,
      (SELECT r.updated_by FROM requirement r WHERE r.company_code = co.company_code
         AND r.required_count_validated > 0 ORDER BY r.updated_at DESC LIMIT 1) AS by,
      (SELECT MAX(r.updated_at) FROM requirement r WHERE r.company_code = co.company_code AND r.required_count_validated > 0) AS at,
      (SELECT i.comment FROM interaction i WHERE i.company_code = co.company_code ORDER BY i.created_at DESC LIMIT 1) AS last_comment
    FROM co WHERE co.val AND NOT co.ho ORDER BY co.company_rank LIMIT 10`, [TIER]);
  if (s4.length === 0) console.log("  none — every validated company has a route decided");
  for (const r of s4) {
    console.log(`   #${r.company_rank} ${cut(r.company_name, 50)}  validated roles=${r.val_roles}  openings=${f(r.val_openings)}`);
    console.log(`       role status: ${r.statuses}   timing: ${r.timing}   last edit: ${String(r.at).slice(0, 10)} by ${r.by}`);
    console.log(`       last call:   "${cut(r.last_comment, 160)}"`);
  }
  console.log("");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
