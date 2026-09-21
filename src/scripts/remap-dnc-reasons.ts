/**
 * Proposal builder for calls filed as "Do not call — Other (comment)".
 * Read-only: writes a CSV in the same shape apply-reason-remap.ts consumes.
 *
 *   npx tsx src/scripts/remap-dnc-reasons.ts
 *
 * Do not call blocks a company from all future outreach, so the default here
 * is to release it back to "No requirement" unless the employer actually asked
 * us to stop calling. The comment -> action map is data/dnc-other-classification.json,
 * built by reading all 120 distinct comments once.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "fs";

const sql = neon(process.env.DATABASE_URL!);
const CONNECTED = `('hiring_now','hiring_later','no_requirement','not_operational','do_not_call')`;
const MAP = JSON.parse(readFileSync("data/dnc-other-classification.json", "utf-8")) as Record<string, string>;
const today = new Date().toISOString().split("T")[0];

type Action = {
  disposition: string | null; reason: string | null; confidence: string; note: string;
  /** Raise a call-back task when releasing a company with no reason on record. */
  task?: string;
};

/** Companies released with no reason recorded get a call-back this many days out. */
const TASK_DAYS = 30;
const taskDue = () => {
  const d = new Date();
  d.setDate(d.getDate() + TASK_DAYS);
  return d.toISOString().split("T")[0];
};

const ACTIONS: Record<string, Action> = {
  GENERIC:          { disposition: "no_requirement", reason: "Other (comment)", confidence: "high",
                      note: "Employer said no, never asked us to stop calling — release from Do not call",
                      task: "Ask why — no reason was recorded when this was closed" },
  SELF_EMPLOYED:    { disposition: "no_requirement", reason: "Self-employed / family-run — no staff", confidence: "high",
                      note: "One-person or family business" },
  NOT_A_BUSINESS:   { disposition: "no_requirement", reason: "Not a hiring business / roles don't match", confidence: "high",
                      note: "No company, or a farmer / shop listed as an employer" },
  NOT_SUBMITTED:    { disposition: "no_requirement", reason: "Not submitted by employer / wrongly entered on EDB", confidence: "high",
                      note: "Employer says the EDB entry is not theirs" },
  NOT_OPERATIONAL:  { disposition: "not_operational", reason: null, confidence: "high",
                      note: "Closed or stopped operating" },
  NOT_COMMISSIONED: { disposition: "no_requirement", reason: "Unit not yet commissioned", confidence: "high",
                      note: "Not started — waiting on licence or loan" },
  NO_ANSWER:        { disposition: "no_answer", reason: "", confidence: "high",
                      note: "Hung up or no proper response — never a conversation" },
  WRONG_CONTACT:    { disposition: "wrong_contact", reason: "", confidence: "high",
                      note: "Wrong number or wrong person" },
  DNC_KEEP:         { disposition: null, reason: null, confidence: "review",
                      note: "Employer asked us not to call again — leave as Do not call" },
  REVIEW:           { disposition: null, reason: null, confidence: "review",
                      note: "Needs a human decision" },
};

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
    JOIN LATERAL (SELECT i.* FROM interaction i WHERE i.company_code = c.company_code
                  AND i.disposition IN ${CONNECTED} ORDER BY i.created_at DESC LIMIT 1) lc ON true
    WHERE lc.disposition = 'do_not_call' AND lc.reason_code = 'Other (comment)'
    ORDER BY c.tier, c.company_rank`)) as Record<string, unknown>[];

  const header = [
    "apply", "action_group", "confidence", "change", "proposed_disposition", "proposed_reason",
    "proposed_followup_date", "task_title", "task_due_date", "why", "tier", "rank", "company_code",
    "company_name", "district", "edb_openings", "caller", "call_date", "current_disposition",
    "current_reason", "caller_comment", "interaction_id",
  ];
  const out: string[][] = [];
  const tally = new Map<string, { n: number; openings: number; a: Action }>();
  const unclassified: string[] = [];

  for (const r of rows) {
    const key = MAP[norm(r.comment).toLowerCase()] ?? "UNCLASSIFIED";
    if (key === "UNCLASSIFIED") unclassified.push(norm(r.comment));
    const a = ACTIONS[key] ?? { disposition: null, reason: null, confidence: "review",
      note: "Logged after this list was built — read it and classify" };

    const changes = !!a.disposition && a.disposition !== r.disposition;
    const t = tally.get(key) ?? { n: 0, openings: 0, a };
    t.n++; t.openings += Number(r.openings) || 0;
    tally.set(key, t);

    out.push([
      changes ? "Y" : "N", key, a.confidence,
      changes ? "outcome + reason" : "none — leave as is",
      a.disposition ?? String(r.disposition),
      a.reason === null ? String(r.reason_code ?? "") : a.reason,
      "", changes && a.task ? a.task : "", changes && a.task ? taskDue() : "", a.note,
      `T${r.tier}`, String(r.company_rank), String(r.company_code), String(r.company_name),
      String(r.district ?? ""), String(r.openings), String(r.username),
      String(r.call_date).slice(0, 10), String(r.disposition), String(r.reason_code ?? ""),
      norm(r.comment), String(r.interaction_id),
    ]);
  }

  const order = Object.keys(ACTIONS);
  out.sort((x, y) => order.indexOf(x[1]) - order.indexOf(y[1]) || x[10].localeCompare(y[10]) || Number(x[11]) - Number(y[11]));
  const file = `data/dnc-remap-proposal-${today}.csv`;
  writeFileSync(file, "﻿" + [header.join(","), ...out.map((r) => r.map(esc).join(","))].join("\n"));

  console.log(`\n${rows.length} companies on Do not call — Other · proposal written to ${file}\n`);
  console.log("group              companies  openings  confidence  becomes");
  console.log("-".repeat(96));
  for (const k of order) {
    const t = tally.get(k);
    if (!t) continue;
    const becomes = t.a.disposition
      ? `${t.a.disposition}${t.a.reason ? ` / ${t.a.reason}` : ""}`
      : "unchanged (stays Do not call)";
    console.log(`${k.padEnd(18)} ${String(t.n).padStart(9)} ${String(t.openings).padStart(9)}  ${t.a.confidence.padEnd(11)} ${becomes}`);
  }
  if (unclassified.length > 0) {
    console.log(`\nNOT YET CLASSIFIED — ${unclassified.length} rows:`);
    for (const c of [...new Set(unclassified)]) console.log(`  "${c}"`);
  }
  const y = out.filter((r) => r[0] === "Y").length;
  console.log(`\nrows pre-marked apply=Y: ${y}   left as Do not call: ${rows.length - y}`);
  console.log(`companies released back into outreach: ${out.filter((r) => r[0] === "Y" && r[4] !== "not_operational").length}`);
  console.log(`call-back tasks to create: ${out.filter((r) => r[7]).length} (due ${taskDue()})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
