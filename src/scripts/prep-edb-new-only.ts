/**
 * Filter an EDB extract down to the roles that are genuinely new to the database,
 * so that ingest-edb-incremental.ts can be run on the result UNMODIFIED.
 *
 *   npx tsx src/scripts/prep-edb-new-only.ts <file.csv> [-o <out.csv>]
 *
 * WHY THIS EXISTS: the ingester dedupes on reference_id + role_name + created_at,
 * backed by ux_req_natural. The 21 Sep extract rewrote created_at on every row —
 * rows already loaded in July/August now carry export-time stamps — so that key
 * matches nothing and a straight re-run would insert the whole file a second time.
 * The stable identity of an EDB role is reference_id + role_name: callers never
 * overwrite requirement.role_name (edits land in role_name_edited; see
 * src/lib/actions/call.ts), so matching on the pair cannot be confused by caller work.
 *
 * Read-only against the database. The only thing written is the filtered CSV.
 * Rows are re-emitted as their exact source text, so nothing is re-quoted.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

type Row = Record<string, string>;
type Parsed = { record: Row; raw: string };

const f = (v: unknown) => (Number(v) || 0).toLocaleString("en-IN");
const head = (t: string) => console.log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`);
const num = (v: string | undefined) => parseInt(v ?? "", 10) || 0;
const pairKey = (r: Row) => `${r.reference_id}||${r.role_name}`;
/** Strip the record's trailing line terminator; we rejoin with \n ourselves. */
const line = (raw: string) => raw.replace(/\r?\n?$/, "").replace(/\r$/, "");

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("-"));
  const filePath = positional[0];
  const oIdx = args.indexOf("-o");
  const outPath = oIdx >= 0 ? args[oIdx + 1] : "data/interim/edb-new-only.csv";

  if (!filePath) {
    console.error("Usage: npx tsx src/scripts/prep-edb-new-only.ts <file.csv> [-o <out.csv>]");
    process.exit(1);
  }

  console.log(`\nREAD-ONLY on the database — the only write is the filtered CSV.`);
  console.log(`file    ${filePath}`);
  console.log(`out     ${outPath}`);

  // ── Parse. Same options the ingester uses, so row counts cannot drift. ──
  const text = readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const parsed: Parsed[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    raw: true,
  });
  console.log(`\nParsed ${f(parsed.length)} rows.`);

  const header = line(text.slice(0, text.indexOf("\n")));
  const headerCols = header.split(",").length;
  const recordCols = Object.keys(parsed[0].record).length;
  if (headerCols !== recordCols) {
    console.error(
      `\nABORT: header has ${headerCols} columns but records have ${recordCols}. ` +
      `The header is not a single plain line; re-emitting it verbatim is unsafe.`
    );
    process.exit(1);
  }

  // ── Quarantine unusable rows. The ingester skips rows with no company_code
  // (see its `if (!code) continue`), so they would reach edb_raw and nothing else.
  // Keeping them out of the filtered file keeps the batch's raw snapshot honest. ──
  const usable = parsed.filter((p) => p.record.company_code && p.record.role_name);
  const junk = parsed.filter((p) => !(p.record.company_code && p.record.role_name));

  // ── Guard: the pair key must be unique inside the file, or filtering is meaningless. ──
  const seen = new Map<string, number>();
  for (const p of usable) seen.set(pairKey(p.record), (seen.get(pairKey(p.record)) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1);
  if (dupes.length) {
    console.error(
      `\nABORT: ${f(dupes.length)} duplicate (reference_id, role_name) pairs in the extract ` +
      `(${f(dupes.reduce((s, [, n]) => s + n - 1, 0))} extra rows). ` +
      `The pair key is not unique here, so it cannot be used to decide what is new.`
    );
    for (const [k, n] of dupes.slice(0, 10)) console.error(`    ${n}x  ${k}`);
    process.exit(1);
  }
  console.log(`Pair key (reference_id, role_name) is unique across all rows.`);

  // ── Current DB state ──
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const [dbRoleRows, dbCoRows] = await Promise.all([
    sql.query(`SELECT reference_id, role_name FROM requirement`),
    sql.query(`SELECT company_code FROM company`),
  ]);
  const dbPairs = new Set(
    dbRoleRows.map((r: Record<string, unknown>) => `${r.reference_id}||${r.role_name}`)
  );
  const dbCos = new Set(dbCoRows.map((r: Record<string, unknown>) => r.company_code as string));

  // ── Split ──
  const kept = usable.filter((p) => !dbPairs.has(pairKey(p.record)));
  const dropped = usable.length - kept.length;

  const newCos = new Set(
    kept.map((p) => p.record.company_code).filter((c) => c && !dbCos.has(c))
  );
  const atNewCos = kept.filter((p) => !dbCos.has(p.record.company_code));
  const atExistingCos = kept.filter((p) => dbCos.has(p.record.company_code));
  const openings = kept.reduce((s, p) => s + num(p.record.required_count), 0);

  head("FILTER RESULT");
  console.log(`  rows in extract                ${f(parsed.length).padStart(8)}`);
  console.log(`  unusable — quarantined         ${f(junk.length).padStart(8)}`);
  console.log(`  already in DB — dropped        ${f(dropped).padStart(8)}`);
  console.log(`  genuinely new — kept           ${f(kept.length).padStart(8)}`);
  console.log(`     at brand-new companies      ${f(atNewCos.length).padStart(8)}`);
  console.log(`     at existing companies       ${f(atExistingCos.length).padStart(8)}`);
  console.log(`\n  roles currently in DB          ${f(dbRoleRows.length).padStart(8)}`);
  console.log(`  companies currently in DB      ${f(dbCos.size).padStart(8)}`);
  console.log(`  new companies arriving         ${f(newCos.size).padStart(8)}`);
  console.log(`  openings arriving              ${f(openings).padStart(8)}`);

  if (junk.length) {
    head("UNUSABLE ROWS — NOT WRITTEN, NOT INGESTED");
    for (const p of junk.slice(0, 20)) {
      console.log(`  line ${String(parsed.indexOf(p) + 2).padEnd(7)}${JSON.stringify(p.raw).slice(0, 90)}`);
    }
    console.log(`\n  Missing company_code and/or role_name — nothing can be keyed off them.`);
  }

  if (atExistingCos.length) {
    head("NEW ROLES AT COMPANIES ALREADY IN THE DATABASE — EYEBALL THESE");
    for (const p of atExistingCos) {
      const r = p.record;
      console.log(
        `  ${(r.company_code ?? "").padEnd(14)}${(r.reference_id ?? "").padEnd(18)}` +
        `req=${String(num(r.required_count)).padEnd(4)}${r.role_name}`
      );
    }
  }

  if (!kept.length) {
    console.log(`\nNothing new in this extract. No file written.\n`);
    process.exit(0);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, [header, ...kept.map((p) => line(p.raw))].join("\n") + "\n", "utf-8");

  head("WRITTEN");
  console.log(`  ${outPath}`);
  console.log(`  ${f(kept.length)} data rows + header, source text re-emitted verbatim.`);
  console.log(`\n  Next:`);
  console.log(`    npx tsx src/scripts/ingest-edb-incremental.ts ${outPath} <extract-date> --dry-run\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
