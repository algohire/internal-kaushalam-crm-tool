/**
 * Proposal builder for the 778 companies closed as "No requirement — Other
 * (comment)". Read-only: writes a CSV you review and edit, which
 * apply-reason-remap.ts then applies. Nothing is written to the database here.
 *
 *   npx tsx src/scripts/remap-other-reasons.ts
 *
 * The comment -> action mapping lives in data/other-reason-classification.json,
 * built by reading all 265 distinct comments once.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "fs";

const sql = neon(process.env.DATABASE_URL!);
const CONNECTED = `('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')`;
const MAP = JSON.parse(readFileSync("data/other-reason-classification.json", "utf-8")) as Record<string, string>;

type Action = {
  disposition: string | null;   // null = leave the outcome as it is
  reason: string | null;        // null = leave the reason as it is
  months?: number | "nextNov";  // follow-up date for Hiring later
  confidence: "high" | "medium" | "review";
  note: string;
};

/** What each comment group should become. New reasons are marked NEW. */
const ACTIONS: Record<string, Action> = {
  ALREADY_FILLED:   { disposition: null, reason: "Requirement already filled", confidence: "high",
                      note: "Existing reason in the list" },
  NOT_OPERATIONAL:  { disposition: "not_operational", reason: null, confidence: "high",
                      note: "Business closed or not running" },
  NOT_COMMISSIONED: { disposition: null, reason: "Unit not yet commissioned", confidence: "high",
                      note: "Existing reason in the list" },
  HIRING_LATER:     { disposition: "hiring_later", reason: null, months: 6, confidence: "medium",
                      note: "Employer gave a timeframe — becomes a follow-up" },
  SEASONAL:         { disposition: null, reason: "Seasonal — not this season", confidence: "high",
                      note: "Existing reason in the list" },
  LATER_NO_DATE:    { disposition: null, reason: "May need later — no date given (NEW)", confidence: "medium",
                      note: "Open door, no date. Needs a new reason" },
  WILL_CONTACT:     { disposition: null, reason: "No need now — will contact if required (NEW)", confidence: "medium",
                      note: "Polite no. Needs a new reason" },
  NO_ANSWER:        { disposition: "no_answer", reason: "", confidence: "high",
                      note: "Never a conversation — should not count as Connected" },
  WRONG_CONTACT:    { disposition: "wrong_contact", reason: "", confidence: "high",
                      note: "Wrong number" },
  SELF_EMPLOYED:    { disposition: null, reason: "Self-employed / family-run — no staff (NEW)", confidence: "high",
                      note: "Needs a new reason" },
  NOT_SUBMITTED:    { disposition: null, reason: "Not submitted by employer / wrongly entered on EDB (NEW)", confidence: "high",
                      note: "EDB source data problem. Needs a new reason" },
  NOT_A_BUSINESS:   { disposition: null, reason: "Not a hiring business / roles don't match (NEW)", confidence: "medium",
                      note: "Needs a new reason" },
  NO_EXPANSION:     { disposition: null, reason: "No expansion planned", confidence: "medium",
                      note: "Existing reason in the list" },
  CALLBACK_HIRING:  { disposition: null, reason: null, confidence: "review",
                      note: "Employer IS hiring — call back, do not remap" },
  KEEP_OTHER_NO_REASON: { disposition: null, reason: null, confidence: "review",
                      note: "No reason in the comment — ask on the next call" },
};

const HIRING_LATER_MONTHS: Record<string, number | "nextNov"> = {
  "he mentioned yet to start hiring process after 6 months": 6,
  "operations yet to start in 6 month will let you know": 6,
  "yet to start hiring process after 6 month will let you know": 6,
  "yet to start hiring process after 6 months": 6,
  "right now no requirement after 1 year may be if he need he will contact": 12,
  "they want to contact us after 1 year right now no requirement": 12,
  "they are not hiring now,they will hire after nov": "nextNov",
};

function followUpDate(callDate: string, spec: number | "nextNov" | undefined): string {
  const d = new Date(callDate);
  if (spec === "nextNov") {
    const year = d.getMonth() >= 10 ? d.getFullYear() + 1 : d.getFullYear();
    return `${year}-11-01`;
  }
  d.setMonth(d.getMonth() + (typeof spec === "number" ? spec : 6));
  return d.toISOString().split("T")[0];
}

const norm = (c: unknown) => String(c ?? "").trim().replace(/\s+/g, " ");
const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const rows = (await sql.query(`
    SELECT c.company_code, c.company_name, c.tier, c.company_rank, c.district,
           COALESCE(c.total_required,0)::int AS openings,
           lc.id AS interaction_id, lc.username, lc.created_at::text AS call_date,
           lc.disposition, lc.reason_code, lc.comment
    FROM company c
    JOIN LATERAL (SELECT i.* FROM interaction i
      WHERE i.company_code = c.company_code AND i.disposition IN ${CONNECTED}
      ORDER BY i.created_at DESC LIMIT 1) lc ON true
    WHERE lc.disposition = 'no_requirement' AND lc.reason_code = 'Other (comment)'
      AND NOT EXISTS (SELECT 1 FROM requirement r WHERE r.company_code = c.company_code
                        AND r.required_count_validated > 0)
    ORDER BY c.tier, c.company_rank`)) as Record<string, unknown>[];

  const header = [
    "apply", "action_group", "confidence", "change", "proposed_disposition", "proposed_reason",
    "proposed_followup_date", "why", "tier", "rank", "company_code", "company_name", "district",
    "edb_openings", "caller", "call_date", "current_disposition", "current_reason", "caller_comment",
    "interaction_id",
  ];
  const out: string[][] = [];
  const unclassified: string[] = [];
  const tally = new Map<string, { n: number; openings: number; a: Action }>();

  for (const r of rows) {
    // Comments logged after the classification was built fall through to
    // "needs a call" rather than failing the run; they are listed at the end.
    const key = MAP[norm(r.comment).toLowerCase()] ?? "UNCLASSIFIED";
    if (key === "UNCLASSIFIED") unclassified.push(norm(r.comment));
    const a = ACTIONS[key] ?? {
      disposition: null, reason: null, confidence: "review" as const,
      note: "Logged after this list was built — read it and classify",
    };
    const changesDisp = !!a.disposition && a.disposition !== r.disposition;
    const changesReason = a.reason !== null;
    const change = changesDisp && changesReason ? "outcome + reason"
      : changesDisp ? "outcome" : changesReason ? "reason" : "none — needs a call";
    const date = a.disposition === "hiring_later"
      ? followUpDate(String(r.call_date), HIRING_LATER_MONTHS[norm(r.comment).toLowerCase()] ?? a.months)
      : "";

    const t = tally.get(key) ?? { n: 0, openings: 0, a };
    t.n++; t.openings += Number(r.openings) || 0;
    tally.set(key, t);

    out.push([
      change === "none — needs a call" ? "N" : "Y",
      key, a.confidence, change,
      a.disposition ?? String(r.disposition),
      a.reason === null ? String(r.reason_code ?? "") : a.reason,
      date, a.note,
      `T${r.tier}`, String(r.company_rank), String(r.company_code), String(r.company_name),
      String(r.district ?? ""), String(r.openings), String(r.username), String(r.call_date).slice(0, 10),
      String(r.disposition), String(r.reason_code ?? ""), norm(r.comment), String(r.interaction_id),
    ]);
  }

  const order = Object.keys(ACTIONS);
  out.sort((x, y) => order.indexOf(x[1]) - order.indexOf(y[1]) || x[8].localeCompare(y[8]) || Number(x[9]) - Number(y[9]));
  const file = "data/other-reason-remap-proposal-2026-09-21.csv";
  writeFileSync(file, "﻿" + [header.join(","), ...out.map((r) => r.map(esc).join(","))].join("\n"));

  console.log(`\n${rows.length} companies · proposal written to ${file}\n`);
  console.log("group                  companies  openings  change            confidence  becomes");
  console.log("-".repeat(112));
  for (const k of order) {
    const t = tally.get(k);
    if (!t) continue;
    const becomes = [t.a.disposition ? `outcome: ${t.a.disposition}` : "", t.a.reason ? `reason: ${t.a.reason}` : ""]
      .filter(Boolean).join(" · ") || "unchanged";
    const change = t.a.disposition ? (t.a.reason ? "outcome + reason" : "outcome") : t.a.reason ? "reason" : "none";
    console.log(`${k.padEnd(22)} ${String(t.n).padStart(9)} ${String(t.openings).padStart(9)}  ${change.padEnd(17)} ${t.a.confidence.padEnd(11)} ${becomes}`);
  }
  const auto = out.filter((r) => r[0] === "Y").length;
  console.log(`\nrows pre-marked apply=Y: ${auto}   apply=N (need a call): ${rows.length - auto}`);
  if (unclassified.length > 0) {
    console.log(`\nNOT YET CLASSIFIED — ${unclassified.length} rows, add them to data/other-reason-classification.json:`);
    for (const c of [...new Set(unclassified)]) console.log(`  "${c}"`);
  }
  const dispChanges = out.filter((r) => r[3].startsWith("outcome"));
  console.log(`outcome changes: ${dispChanges.length}  (connected count would fall by ${out.filter((r) => ["no_answer", "wrong_contact"].includes(r[4])).length})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
