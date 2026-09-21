/**
 * Two exports for the reason clean-up. Read-only.
 *
 *   npx tsx src/scripts/export-reason-audit.ts
 *
 *   1. still-other-<date>.csv   — calls still filed as "Other (comment)",
 *      with the caller's comment and who logged it.
 *   2. reason-remap-log-<date>.csv — every call that was remapped: what it
 *      was, what it became, and why.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";

const sql = neon(process.env.DATABASE_URL!);
const CONNECTED = `('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')`;
const today = new Date().toISOString().split("T")[0];

const GROUP_LABELS: Record<string, string> = {
  ALREADY_FILLED: "Already hired / enough staff",
  NOT_OPERATIONAL: "Business closed or not running",
  NOT_COMMISSIONED: "Unit not started yet",
  HIRING_LATER: "Gave a timeframe — now a follow-up",
  SEASONAL: "Seasonal hiring",
  LATER_NO_DATE: "May need later, no date given",
  WILL_CONTACT: "Will contact us if needed",
  NO_ANSWER: "Never a conversation (hung up, busy, not answered)",
  WRONG_CONTACT: "Wrong number",
  SELF_EMPLOYED: "Self-employed or family-run",
  NOT_SUBMITTED: "Never submitted on EDB / wrongly entered",
  NOT_A_BUSINESS: "Not a hiring business / roles don't match",
  NO_EXPANSION: "No expansion planned",
};

/** Guards against a leading character a spreadsheet would treat as a formula. */
const esc = (v: unknown) => {
  let s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const write = (name: string, header: string[], rows: unknown[][]) => {
  const file = `data/${name}-${today}.csv`;
  writeFileSync(file, "﻿" + [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n"));
  console.log(`${String(rows.length).padStart(5)} rows  ${file}`);
};

async function main() {
  // 1. Still "Other" — the latest connected call per company, where nothing
  //    in the comment identified a reason.
  const still = (await sql.query(`
    SELECT c.tier, c.company_rank, c.company_code, c.company_name, c.district,
           COALESCE(c.total_required,0)::int AS openings,
           lc.disposition, lc.username, lc.created_at::text AS call_date, lc.comment,
           (SELECT COUNT(*) FROM interaction i2 WHERE i2.company_code = c.company_code)::int AS calls
    FROM company c
    JOIN LATERAL (SELECT i.* FROM interaction i WHERE i.company_code = c.company_code
                  AND i.disposition IN ${CONNECTED} ORDER BY i.created_at DESC LIMIT 1) lc ON true
    WHERE lc.reason_code = 'Other (comment)'
    ORDER BY c.tier, c.company_rank`)) as Record<string, unknown>[];

  write("still-other", [
    "tier", "rank", "company_code", "company_name", "district", "edb_openings",
    "outcome", "reason", "caller", "call_date", "calls_made", "caller_comment",
  ], still.map((r) => [
    `T${r.tier}`, r.company_rank, r.company_code, r.company_name, r.district, r.openings,
    r.disposition, "Other (comment)", r.username, String(r.call_date).slice(0, 10), r.calls, r.comment,
  ]));

  // 2. What was remapped — straight from the audit trail written at apply time.
  const log = (await sql.query(`
    SELECT a.created_at::text AS remapped_at, a.detail_json, a.username AS original_caller,
           i.comment, i.created_at::text AS call_date, i.next_action_date,
           c.tier, c.company_rank, c.company_name, c.district,
           COALESCE(c.total_required,0)::int AS openings,
           EXISTS (SELECT 1 FROM task t WHERE t.created_by_interaction = i.id
                     AND t.title LIKE 'Follow up — employer said%') AS follow_up_task
    FROM audit_log a
    JOIN interaction i ON i.id = a.object_id
    JOIN company c ON c.company_code = i.company_code
    WHERE a.action = 'reason_remap'
    ORDER BY a.created_at`)) as Record<string, unknown>[];

  write("reason-remap-log", [
    "group", "tier", "rank", "company_code", "company_name", "district", "edb_openings",
    "caller", "call_date", "was_outcome", "was_reason", "now_outcome", "now_reason",
    "follow_up_date", "follow_up_task_created", "remapped_at", "caller_comment",
  ], log.map((r) => {
    const d = JSON.parse(String(r.detail_json)) as {
      companyCode: string; group: string;
      from: { disposition: string; reasonCode: string | null };
      to: { disposition: string; reasonCode: string | null };
    };
    const isLater = d.to.disposition === "hiring_later";
    return [
      GROUP_LABELS[d.group] ?? d.group, `T${r.tier}`, r.company_rank, d.companyCode, r.company_name,
      r.district, r.openings, r.original_caller, String(r.call_date).slice(0, 10),
      d.from.disposition, d.from.reasonCode ?? "", d.to.disposition,
      isLater ? "" : (d.to.reasonCode ?? ""),
      isLater ? (d.to.reasonCode ?? "") : "", r.follow_up_task ? "yes" : "",
      String(r.remapped_at).slice(0, 10), r.comment,
    ];
  }));

  // Console summaries so the counts are visible without opening the files.
  const by = (rows: Record<string, unknown>[], key: (r: Record<string, unknown>) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  console.log("\nStill Other — by caller:");
  for (const [k, v] of by(still, (r) => String(r.username))) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log("\nStill Other — by outcome:");
  for (const [k, v] of by(still, (r) => String(r.disposition))) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log("\nRemapped — by group:");
  for (const [k, v] of by(log, (r) => GROUP_LABELS[JSON.parse(String(r.detail_json)).group] ?? "?")) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
