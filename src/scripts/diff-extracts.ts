/**
 * Compare two EDB extracts, and compare the new one against what is in the DB.
 * Read-only. Writes nothing.
 *
 *   npx tsx src/scripts/diff-extracts.ts <old.csv> <new.csv>
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

type Row = Record<string, string>;

function f(v: unknown): string {
  return (Number(v) || 0).toLocaleString("en-IN");
}
function head(t: string) {
  console.log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`);
}
/** Natural key used by the requirement table's unique index. */
function roleKey(r: Row): string {
  return `${r.reference_id}||${r.role_name}||${r.created_at}`;
}
function load(path: string): Row[] {
  const raw = readFileSync(path, "utf-8").replace(/^﻿/, "");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}
function num(v: string | undefined): number {
  return parseInt(v ?? "", 10) || 0;
}

async function main() {
  const [oldPath, newPath] = process.argv.slice(2);
  if (!oldPath || !newPath) {
    console.error("Usage: npx tsx src/scripts/diff-extracts.ts <old.csv> <new.csv>");
    process.exit(1);
  }

  console.log("\nLoading extracts…");
  const oldRows = load(oldPath);
  const newRows = load(newPath);

  head("FILE TOTALS");
  console.log("                          OLD        NEW      DELTA");
  console.log("  " + "-".repeat(52));
  const oldCos = new Set(oldRows.map((r) => r.company_code).filter(Boolean));
  const newCos = new Set(newRows.map((r) => r.company_code).filter(Boolean));
  const oldSubs = new Set(oldRows.map((r) => r.reference_id).filter(Boolean));
  const newSubs = new Set(newRows.map((r) => r.reference_id).filter(Boolean));
  const oldOpen = oldRows.reduce((s, r) => s + num(r.required_count), 0);
  const newOpen = newRows.reduce((s, r) => s + num(r.required_count), 0);

  const line = (label: string, a: number, b: number) =>
    console.log(
      `  ${label.padEnd(22)}${f(a).padStart(9)}${f(b).padStart(11)}${(b - a >= 0 ? "+" : "") + f(b - a)}`.padEnd(60)
    );
  line("rows (roles)", oldRows.length, newRows.length);
  line("companies", oldCos.size, newCos.size);
  line("submissions", oldSubs.size, newSubs.size);
  line("openings", oldOpen, newOpen);

  // ── Company-level set diff ──
  const addedCos = [...newCos].filter((c) => !oldCos.has(c));
  const droppedCos = [...oldCos].filter((c) => !newCos.has(c));

  head("COMPANIES");
  console.log(`  in both              ${f(newCos.size - addedCos.length).padStart(8)}`);
  console.log(`  NEW in 04 Sep        ${f(addedCos.length).padStart(8)}`);
  console.log(`  gone from 04 Sep     ${f(droppedCos.length).padStart(8)}`);

  // ── Role-level set diff on natural key ──
  const oldKeys = new Map(oldRows.map((r) => [roleKey(r), r]));
  const newKeys = new Map(newRows.map((r) => [roleKey(r), r]));
  const addedRoles = [...newKeys.keys()].filter((k) => !oldKeys.has(k));
  const droppedRoles = [...oldKeys.keys()].filter((k) => !newKeys.has(k));

  head("ROLES (natural key: reference_id + role_name + created_at)");
  console.log(`  in both              ${f(newKeys.size - addedRoles.length).padStart(8)}`);
  console.log(`  NEW in 04 Sep        ${f(addedRoles.length).padStart(8)}`);
  console.log(`  gone from 04 Sep     ${f(droppedRoles.length).padStart(8)}`);

  const addedOpenings = addedRoles.reduce((s, k) => s + num(newKeys.get(k)!.required_count), 0);
  console.log(`  openings on new roles${f(addedOpenings).padStart(8)}`);

  // Split new roles: at existing company vs at brand-new company
  const addedSet = new Set(addedCos);
  let atNewCo = 0, atOldCo = 0, atNewCoOpen = 0, atOldCoOpen = 0;
  for (const k of addedRoles) {
    const r = newKeys.get(k)!;
    if (addedSet.has(r.company_code)) { atNewCo++; atNewCoOpen += num(r.required_count); }
    else { atOldCo++; atOldCoOpen += num(r.required_count); }
  }
  console.log(`\n  new roles at NEW companies      ${f(atNewCo).padStart(7)}  (${f(atNewCoOpen)} openings)`);
  console.log(`  new roles at EXISTING companies ${f(atOldCo).padStart(7)}  (${f(atOldCoOpen)} openings)`);

  // ── Did EDB fields change on roles present in both? ──
  const EDB_FIELDS = [
    "required_count", "required_within_months", "current_employment",
    "skills", "is_custom",
  ];
  const CO_FIELDS = [
    "company_name", "company_legal_name", "company_gstin", "company_pan",
    "company_sector", "sectors", "subsectors", "company_district_name",
    "company_mandal", "company_village", "company_stage", "present_headcount",
    "company_plant_location", "company_udyam_number", "project_name",
  ];
  const changedBy: Record<string, number> = {};
  let changedRoles = 0;
  for (const [k, nr] of newKeys) {
    const or = oldKeys.get(k);
    if (!or) continue;
    let touched = false;
    for (const fld of [...EDB_FIELDS, ...CO_FIELDS]) {
      if ((or[fld] ?? "") !== (nr[fld] ?? "")) {
        changedBy[fld] = (changedBy[fld] ?? 0) + 1;
        touched = true;
      }
    }
    if (touched) changedRoles++;
  }

  head("EDB FIELD CHANGES ON ROLES PRESENT IN BOTH FILES");
  console.log(`  roles with at least one changed field  ${f(changedRoles).padStart(7)}\n`);
  const entries = Object.entries(changedBy).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    console.log("  No EDB field changed on any shared role.");
  } else {
    console.log("  field                        roles changed");
    console.log("  " + "-".repeat(46));
    for (const [fld, c] of entries) {
      console.log(`  ${fld.padEnd(30)}${f(c).padStart(8)}`);
    }
  }

  // ── Compare new file against the DATABASE ──
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const dbCoRows = await sql.query(`SELECT company_code FROM company`);
  const dbCos = new Set(dbCoRows.map((r: Record<string, unknown>) => r.company_code as string));

  const dbRoleRows = await sql.query(
    `SELECT reference_id, role_name, created_at_edb FROM requirement`
  );
  const dbKeys = new Set(
    dbRoleRows.map(
      (r: Record<string, unknown>) =>
        `${r.reference_id}||${r.role_name}||${r.created_at_edb}`
    )
  );

  const coToInsert = [...newCos].filter((c) => !dbCos.has(c));
  const rolesToInsert = [...newKeys.keys()].filter((k) => !dbKeys.has(k));
  const rolesToInsertOpen = rolesToInsert.reduce(
    (s, k) => s + num(newKeys.get(k)!.required_count), 0);

  head("WHAT AN INCREMENTAL LOAD WOULD INSERT (vs live database)");
  console.log(`  companies currently in DB        ${f(dbCos.size).padStart(8)}`);
  console.log(`  roles currently in DB            ${f(dbKeys.size).padStart(8)}`);
  console.log(`\n  companies to INSERT              ${f(coToInsert.length).padStart(8)}`);
  console.log(`  roles to INSERT                  ${f(rolesToInsert.length).padStart(8)}`);
  console.log(`  openings arriving                ${f(rolesToInsertOpen).padStart(8)}`);
  console.log(`\n  companies after load             ${f(dbCos.size + coToInsert.length).padStart(8)}`);
  console.log(`  roles after load                 ${f(dbKeys.size + rolesToInsert.length).padStart(8)}`);

  // DB roles not in the new file (caller-added, or dropped by EDB)
  const dbOnly = [...dbKeys].filter((k) => !newKeys.has(k));
  const callerAdded = dbOnly.filter((k) => k.startsWith("CALLER-"));
  head("ROLES IN DB BUT NOT IN THE NEW FILE");
  console.log(`  total                            ${f(dbOnly.length).padStart(8)}`);
  console.log(`    added by callers (CALLER-*)    ${f(callerAdded.length).padStart(8)}   must be preserved`);
  console.log(`    dropped by EDB                 ${f(dbOnly.length - callerAdded.length).padStart(8)}   leave in place, flag`);

  // ── Tier impact ──
  head("TIER IMPACT");
  const totals = new Map<string, number>();
  for (const r of newRows) {
    if (!r.company_code) continue;
    totals.set(r.company_code, (totals.get(r.company_code) ?? 0) + num(r.required_count));
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const tierOf = (i: number) => (i < 300 ? 1 : i < 1000 ? 2 : i < 2843 ? 3 : 4);
  const newTier = new Map<string, number>();
  ranked.forEach(([code], i) => newTier.set(code, tierOf(i)));

  const dbTierRows = await sql.query(`SELECT company_code, tier FROM company`);
  let moved = 0;
  const movement: Record<string, number> = {};
  for (const r of dbTierRows) {
    const code = r.company_code as string;
    const was = Number(r.tier);
    const now = newTier.get(code);
    if (now && now !== was) {
      moved++;
      movement[`T${was} -> T${now}`] = (movement[`T${was} -> T${now}`] ?? 0) + 1;
    }
  }
  console.log(`  existing companies whose tier would change  ${f(moved).padStart(6)}`);
  if (moved > 0) {
    console.log("");
    for (const [k, v] of Object.entries(movement).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(14)}${f(v).padStart(6)}`);
    }
  }

  console.log("");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
