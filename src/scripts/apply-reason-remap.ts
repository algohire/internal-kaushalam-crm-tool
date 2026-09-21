/**
 * Applies the reviewed remap proposal to the call records. Dry run unless
 * --apply is passed. Only rows with apply=Y are touched, and only the
 * disposition / reason of that one call — comments are never altered.
 *
 *   npx tsx src/scripts/apply-reason-remap.ts [csv] [--apply]
 *
 * Writes data/reason-remap-backup-<date>.json before any change. Uses the
 * neon HTTP driver's transaction batch (the pooled driver needs a WebSocket,
 * which Node has no global for).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { dispositions, noRequirementReasons, dispositionRequiresReason } from "../lib/config/dropdowns";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CSV = args.find((a) => a.endsWith(".csv")) ?? "data/other-reason-remap-proposal-2026-09-21.csv";
const today = new Date().toISOString().split("T")[0];
const now = new Date().toISOString();
const stripNew = (s: string) => s.replace(/\s*\(NEW\)\s*$/, "").trim();

const sql = neon(process.env.DATABASE_URL!);
type Row = Record<string, string>;

async function main() {
  const rows = parse(readFileSync(CSV, "utf-8").replace(/^﻿/, ""), {
    columns: true, skip_empty_lines: true, trim: true,
  }) as Row[];
  const todo = rows.filter((r) => r.apply.toUpperCase() === "Y" && r.change !== "none — needs a call");
  console.log(`${rows.length} rows in ${CSV}; ${todo.length} marked to apply`);

  // Validate every proposed value against the dropdowns before touching anything.
  const codes = new Set(dispositions.map((d) => d.code));
  const reasons = new Set(noRequirementReasons);
  for (const r of todo) {
    if (!codes.has(r.proposed_disposition)) throw new Error(`Unknown disposition: ${r.proposed_disposition}`);
    const reason = stripNew(r.proposed_reason);
    if (r.proposed_disposition === "no_requirement" && !reasons.has(reason)) {
      throw new Error(`Unknown reason: "${reason}" (${r.company_code})`);
    }
    if (r.proposed_disposition === "hiring_later" && !/^\d{4}-\d{2}-\d{2}$/.test(r.proposed_followup_date)) {
      throw new Error(`Hiring later needs a follow-up date: ${r.company_code}`);
    }
  }

  const ids = todo.map((r) => r.interaction_id);
  const current = (await sql.query(
    `SELECT i.id, i.company_code, i.user_id, i.username, i.disposition, i.reason_code,
            i.next_action_date, (i.id = l.latest_id) AS is_latest
       FROM interaction i
       JOIN LATERAL (SELECT id AS latest_id FROM interaction x
                     WHERE x.company_code = i.company_code
                     ORDER BY x.created_at DESC LIMIT 1) l ON true
      WHERE i.id = ANY($1)`, [ids])) as Record<string, unknown>[];
  const byId = new Map(current.map((c) => [c.id as string, c]));

  const statements: ReturnType<typeof sql>[] = [];
  const backup: unknown[] = [];
  const summary = new Map<string, number>();
  let tasks = 0, skipped = 0;

  for (const r of todo) {
    const cur = byId.get(r.interaction_id);
    if (!cur) throw new Error(`Interaction not found: ${r.interaction_id}`);
    // Guard: only remap calls still holding the values the proposal was built from.
    if (cur.disposition !== r.current_disposition || String(cur.reason_code ?? "") !== r.current_reason) {
      skipped++;
      continue;
    }

    const newDisp = r.proposed_disposition;
    const isLater = newDisp === "hiring_later";
    // Hiring later keeps its follow-up date in reason_code, as the form does.
    // Outcomes that need no reason get it cleared rather than left as "Other".
    const newReason = isLater ? r.proposed_followup_date
      : dispositionRequiresReason(newDisp) ? stripNew(r.proposed_reason) : null;
    const newNextDate = isLater ? r.proposed_followup_date : (cur.next_action_date as string);

    backup.push({
      interactionId: cur.id, companyCode: cur.company_code, group: r.action_group,
      before: { disposition: cur.disposition, reasonCode: cur.reason_code, nextActionDate: cur.next_action_date },
      after: { disposition: newDisp, reasonCode: newReason, nextActionDate: newNextDate },
      companyLastDispositionUpdated: !!cur.is_latest,
    });

    statements.push(sql`UPDATE interaction SET disposition = ${newDisp}, reason_code = ${newReason},
                          next_action_date = ${newNextDate} WHERE id = ${cur.id}`);
    if (cur.is_latest) {
      statements.push(sql`UPDATE company SET last_disposition = ${newDisp}, updated_at = ${now}
                            WHERE company_code = ${cur.company_code}`);
    }
    // A remap is only useful if somebody is asked to call back: "hiring later"
    // gets the date the employer gave, other rows use the task columns.
    const taskTitle = isLater ? "Follow up — employer said they would hire later" : (r.task_title ?? "");
    const taskDue = isLater ? r.proposed_followup_date : (r.task_due_date ?? "");
    if (taskTitle && taskDue) {
      statements.push(sql`INSERT INTO task (id, company_code, user_id, title, due_date, source, status,
                            created_by_interaction, created_at)
                          VALUES (${crypto.randomUUID()}, ${cur.company_code}, ${cur.user_id},
                            ${taskTitle}, ${taskDue}, 'next_step', 'open', ${cur.id}, ${now})`);
      tasks++;
    }
    statements.push(sql`INSERT INTO audit_log (id, user_id, username, action, object_type, object_id,
                          detail_json, created_at)
                        VALUES (${crypto.randomUUID()}, ${cur.user_id}, ${cur.username}, 'reason_remap',
                          'interaction', ${cur.id}, ${JSON.stringify({
                            companyCode: cur.company_code, group: r.action_group, source: CSV,
                            from: { disposition: cur.disposition, reasonCode: cur.reason_code },
                            to: { disposition: newDisp, reasonCode: newReason },
                          })}, ${now})`);

    const k = `${r.action_group}: -> ${newDisp} / ${newReason ?? "—"}`;
    summary.set(k, (summary.get(k) ?? 0) + 1);
  }

  // Named after the source proposal so two remaps on one day cannot overwrite
  // each other's backup.
  const stem = CSV.split("/").pop()!.replace(/\.csv$/, "");
  const file = `data/backup-${stem}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 1));
  console.log(`\nbackup written: ${file} (${backup.length} calls)`);
  if (skipped > 0) console.log(`skipped ${skipped} rows changed since the proposal was built`);

  console.log("");
  for (const [k, v] of [...summary].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\n  ${backup.length} calls · ${tasks} follow-up tasks · ${statements.length} statements`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
    return;
  }
  // Chunked so a batch stays within the HTTP driver's limits; the backup file
  // covers a partial run.
  const SIZE = 100;
  for (let i = 0; i < statements.length; i += SIZE) {
    await sql.transaction(statements.slice(i, i + SIZE));
    process.stdout.write(`  committed ${Math.min(i + SIZE, statements.length)}/${statements.length}\r`);
  }
  console.log(`\nCOMMITTED ${statements.length} statements`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
