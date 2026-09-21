/**
 * Incremental EDB load. Inserts only what is new. Never touches existing rows,
 * so caller work (validated counts, classification, status, comments) is safe.
 *
 *   npx tsx src/scripts/ingest-edb-incremental.ts <file.csv> <extract-date> --dry-run
 *   npx tsx src/scripts/ingest-edb-incremental.ts <file.csv> <extract-date>
 *
 * TIER POLICY: existing companies keep their tier and rank untouched. New
 * companies are tiered against the openings thresholds already implied by the
 * existing bands, not by re-ranking — otherwise a new company with 3 openings
 * would land in Tier 1 simply by topping a small new cohort. New ranks are
 * appended after the current maximum.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

type Row = Record<string, string>;

const f = (v: unknown) => (Number(v) || 0).toLocaleString("en-IN");
const head = (t: string) => console.log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`);
const num = (v: string | undefined) => parseInt(v ?? "", 10) || 0;
const roleKey = (r: Row) => `${r.reference_id}||${r.role_name}||${r.created_at}`;

function normalizeMobile(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}
function isValidGSTIN(g: string): boolean {
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(g);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((a) => !a.startsWith("--"));
  const filePath = positional[0];
  const extractDate = positional[1];

  if (!filePath || !extractDate) {
    console.error("Usage: npx tsx src/scripts/ingest-edb-incremental.ts <file.csv> <extract-date> [--dry-run]");
    process.exit(1);
  }

  const { db } = await import("../lib/db");
  const schema = await import("../lib/db/schema");
  const { eq, sql: dsql } = await import("drizzle-orm");
  const { neon } = await import("@neondatabase/serverless");
  const raw = neon(process.env.DATABASE_URL!);

  console.log(`\n${dryRun ? "DRY RUN — nothing will be written" : "LIVE RUN"}`);
  console.log(`file    ${filePath}`);
  console.log(`extract ${extractDate}`);

  // ── Parse ──
  const rows: Row[] = parse(
    readFileSync(filePath, "utf-8").replace(/^﻿/, ""),
    { columns: true, skip_empty_lines: true, trim: true }
  );
  console.log(`\nParsed ${f(rows.length)} rows.`);

  // ── Current DB state ──
  const [dbCoRows, dbRoleRows, dbGstinRows, [maxRank]] = await Promise.all([
    raw.query(`SELECT company_code FROM company`),
    raw.query(`SELECT reference_id, role_name, created_at_edb FROM requirement`),
    raw.query(`SELECT gstin, company_code FROM company WHERE gstin IS NOT NULL AND gstin <> ''`),
    raw.query(`SELECT COALESCE(MAX(company_rank),0)::int mx FROM company`),
  ]);
  const dbCos = new Set(dbCoRows.map((r: Record<string, unknown>) => r.company_code as string));
  const dbKeys = new Set(
    dbRoleRows.map((r: Record<string, unknown>) =>
      `${r.reference_id}||${r.role_name}||${r.created_at_edb}`)
  );

  // ── Tier thresholds implied by the existing bands ──
  const bands = await raw.query(
    `SELECT tier, MIN(total_required)::int min_open
     FROM company WHERE tier IS NOT NULL GROUP BY tier ORDER BY tier`
  );
  const thresh: Record<number, number> = {};
  for (const b of bands) thresh[Number(b.tier)] = Number(b.min_open);
  const tierFor = (openings: number): number => {
    if (openings >= (thresh[1] ?? Infinity)) return 1;
    if (openings >= (thresh[2] ?? Infinity)) return 2;
    if (openings >= (thresh[3] ?? Infinity)) return 3;
    return 4;
  };

  head("TIER THRESHOLDS TAKEN FROM EXISTING BANDS");
  console.log(`  T1  openings >= ${thresh[1]}`);
  console.log(`  T2  openings >= ${thresh[2]}`);
  console.log(`  T3  openings >= ${thresh[3]}`);
  console.log(`  T4  everything below`);
  console.log(`\n  Existing companies keep their current tier and rank.`);
  console.log(`  New ranks continue from ${f(maxRank.mx)}.`);

  // ── Aggregate new companies ──
  type Agg = {
    code: string; row: Row; maxHeadcount: number; totalRequired: number;
    roleCount: number; flags: Set<string>;
    cName: string; cDesig: string; cMobileRaw: string; cEmail: string;
  };
  const coMap = new Map<string, Agg>();
  const newRoleRows: Row[] = [];

  for (const r of rows) {
    const code = r.company_code;
    if (!code) continue;

    if (!dbKeys.has(roleKey(r))) newRoleRows.push(r);
    if (dbCos.has(code)) continue; // existing company — untouched

    let a = coMap.get(code);
    if (!a) {
      a = {
        code, row: r, maxHeadcount: 0, totalRequired: 0, roleCount: 0,
        flags: new Set<string>(),
        cName: r.submitter_name ?? "", cDesig: r.submitter_designation ?? "",
        cMobileRaw: r.submitter_mobile ?? "", cEmail: r.submitter_email ?? "",
      };
      coMap.set(code, a);
    }
    a.maxHeadcount = Math.max(a.maxHeadcount, num(r.present_headcount));
    a.totalRequired += num(r.required_count);
    a.roleCount++;

    const mob = normalizeMobile(r.submitter_mobile);
    if (!normalizeMobile(a.cMobileRaw) && mob) {
      a.cName = r.submitter_name ?? a.cName;
      a.cDesig = r.submitter_designation ?? a.cDesig;
      a.cMobileRaw = r.submitter_mobile ?? a.cMobileRaw;
      a.cEmail = r.submitter_email ?? a.cEmail;
    }

    const nm = (r.company_name ?? "").toLowerCase();
    if (/^(test|abc|xyz|sample|dummy)/i.test(nm)) a.flags.add("test_record");
    if (!mob && !r.submitter_email) a.flags.add("no_working_contact");
    if (!r.company_district_name) a.flags.add("district_missing");
    if (r.company_gstin && !isValidGSTIN(r.company_gstin)) a.flags.add("gstin_format_invalid");
  }

  // GSTIN shared across codes — check new against new AND against existing
  const gstinOwners = new Map<string, Set<string>>();
  for (const g of dbGstinRows) {
    const k = g.gstin as string;
    if (!gstinOwners.has(k)) gstinOwners.set(k, new Set());
    gstinOwners.get(k)!.add(g.company_code as string);
  }
  for (const a of coMap.values()) {
    const g = a.row.company_gstin;
    if (!g) continue;
    if (!gstinOwners.has(g)) gstinOwners.set(g, new Set());
    gstinOwners.get(g)!.add(a.code);
  }
  for (const a of coMap.values()) {
    const g = a.row.company_gstin;
    if (g && (gstinOwners.get(g)?.size ?? 0) > 1) a.flags.add("gstin_shared_by_multiple_codes");
  }

  // Rank + tier for new companies
  const newCos = [...coMap.values()].sort(
    (x, y) => y.totalRequired - x.totalRequired || x.code.localeCompare(y.code)
  );
  let rank = Number(maxRank.mx);
  const tierCount: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const withRank = newCos.map((a) => {
    rank++;
    const tier = tierFor(a.totalRequired);
    tierCount[tier]++;
    return { ...a, rank, tier };
  });

  // Requirement-level flags for the new roles
  const reqFlags = new Map<string, Set<string>>();
  for (const r of newRoleRows) {
    const s = new Set<string>();
    const rc = num(r.required_count);
    const wm = num(r.required_within_months);
    const hc = num(r.present_headcount);
    if (wm >= 120) s.add("timeline_default_120m");
    if (rc === 0) s.add("required_count_missing");
    if (hc >= 10 && rc >= 3 * hc) s.add("outlier_high_vs_headcount");
    if (r.is_custom === "true") s.add("custom_role_title");
    if (s.size) reqFlags.set(roleKey(r), s);
  }

  // Contacts + tasks only for brand-new companies
  const contactsToAdd = withRank.filter((a) => a.cName || a.cMobileRaw || a.cEmail);
  const newRolesAtNewCos = newRoleRows.filter((r) => coMap.has(r.company_code)).length;

  head("PLAN");
  console.log(`  companies to insert          ${f(withRank.length).padStart(8)}`);
  console.log(`  roles to insert              ${f(newRoleRows.length).padStart(8)}`);
  console.log(`     at new companies          ${f(newRolesAtNewCos).padStart(8)}`);
  console.log(`     at existing companies     ${f(newRoleRows.length - newRolesAtNewCos).padStart(8)}`);
  console.log(`  contacts to insert           ${f(contactsToAdd.length).padStart(8)}`);
  console.log(`  first-call tasks to insert   ${f(withRank.length).padStart(8)}`);
  console.log(`  edb_raw rows (full snapshot) ${f(rows.length).padStart(8)}`);
  console.log(`\n  existing rows modified               0   <- caller work untouched`);

  console.log(`\n  New companies by tier:`);
  for (const t of [1, 2, 3, 4]) {
    console.log(`    T${t}  ${f(tierCount[t]).padStart(6)}`);
  }
  const newOpenings = withRank.reduce((s, a) => s + a.totalRequired, 0);
  console.log(`\n  openings arriving            ${f(newOpenings).padStart(8)}`);
  console.log(`  new rank range               ${f(Number(maxRank.mx) + 1)} – ${f(rank)}`);

  if (dryRun) {
    console.log(`\nDry run complete. Nothing written.\n`);
    process.exit(0);
  }

  // ═══════════════════ WRITE ═══════════════════
  const now = new Date().toISOString();
  const today = now.split("T")[0];
  const batchId = crypto.randomUUID();

  console.log(`\nWriting…`);

  await db.insert(schema.importBatch).values({
    id: batchId,
    sourceFile: filePath.split("/").pop() ?? filePath,
    extractDate,
    importedAt: now,
    importedBy: "ingest-edb-incremental",
    rowCount: rows.length,
    companyCount: withRank.length,
    requirementCount: newRoleRows.length,
    notes: `Incremental load. ${withRank.length} new companies, ${newRoleRows.length} new roles. Existing rows untouched.`,
  });
  console.log(`  [1/6] import_batch ${batchId}`);

  const B = 500;
  for (let i = 0; i < rows.length; i += B) {
    await db.insert(schema.edbRaw).values(
      rows.slice(i, i + B).map((r, k) => ({
        id: crypto.randomUUID(),
        batchId,
        rowNo: i + k + 1,
        referenceId: r.reference_id || null,
        companyCode: r.company_code || null,
        roleName: r.role_name || null,
        rowJson: JSON.stringify(r),
      }))
    );
  }
  console.log(`  [2/6] edb_raw          ${f(rows.length)} rows`);

  const CB = 200;
  for (let i = 0; i < withRank.length; i += CB) {
    await db.insert(schema.company).values(
      withRank.slice(i, i + CB).map((a) => ({
        companyCode: a.code,
        companyName: a.row.company_name || a.code,
        legalName: a.row.company_legal_name || null,
        gstin: a.row.company_gstin || null,
        pan: a.row.company_pan || null,
        udyamNumber: a.row.company_udyam_number || null,
        sector: a.row.company_sector || null,
        sectors: a.row.sectors || null,
        subsectors: a.row.subsectors || null,
        lineOfActivity: a.row.company_line_of_activity || null,
        plantLocation: a.row.company_plant_location || null,
        district: a.row.company_district_name || null,
        mandal: a.row.company_mandal || null,
        village: a.row.company_village || null,
        stage: a.row.company_stage || null,
        projectName: a.row.project_name || null,
        presentHeadcount: a.maxHeadcount,
        totalRequired: a.totalRequired,
        companyRank: a.rank,
        tier: a.tier,
        flags: a.flags.size ? [...a.flags].join(";") : null,
        tags: null,
        lastDisposition: null,
        lastContactAt: null,
        contactCount: 0,
        firstSeenBatch: batchId,
        lastSeenBatch: batchId,
        createdAt: now,
        updatedAt: now,
      }))
    ).onConflictDoNothing();
  }
  console.log(`  [3/6] company          ${f(withRank.length)} inserted`);

  for (let i = 0; i < contactsToAdd.length; i += CB) {
    const batch = contactsToAdd.slice(i, i + CB).map((a) => {
      const m = normalizeMobile(a.cMobileRaw);
      return {
        id: crypto.randomUUID(),
        companyCode: a.code,
        name: a.cName || null,
        designation: a.cDesig || null,
        mobileRaw: a.cMobileRaw || null,
        mobile: m,
        email: a.cEmail || null,
        pocFor: "requirement",
        source: "edb",
        referenceId: null,
        isPrimary: true,
        valid: true,
        createdAt: now,
        createdBy: "ingest-edb-incremental",
      };
    });
    if (batch.length) await db.insert(schema.contact).values(batch as never);
  }
  console.log(`  [4/6] contact          ${f(contactsToAdd.length)} inserted`);

  for (let i = 0; i < newRoleRows.length; i += B) {
    await db.insert(schema.requirement).values(
      newRoleRows.slice(i, i + B).map((r) => {
        const fl = reqFlags.get(roleKey(r));
        return {
          id: crypto.randomUUID(),
          companyCode: r.company_code,
          referenceId: r.reference_id || "",
          edbRowId: null,
          roleName: r.role_name || "Unknown",
          isCustom: r.is_custom === "true",
          currentEmployment: num(r.current_employment) || null,
          requiredCount: num(r.required_count) || null,
          requiredWithinMonths: num(r.required_within_months) || null,
          skills: r.skills || null,
          createdAtEdb: r.created_at || null,
          roleNameEdited: null,
          standardRole: null,
          requiredCountValidated: null,
          timing: null,
          timingDate: null,
          qualification: null,
          experienceFrom: null,
          experienceTo: null,
          genderPreference: null,
          ageLimit: null,
          salary: null,
          pwd: false,
          needTraining: false,
          qpCode: null,
          classification: null,
          collectorDistrict: null,
          status: "captured",
          handoffComment: null,
          handedOverAt: null,
          handedOverBy: null,
          comment: null,
          flags: fl ? [...fl].join(";") : null,
          version: 1,
          createdAt: now,
          updatedAt: now,
          updatedBy: "edb",
        };
      }) as never
    ).onConflictDoNothing();
  }
  console.log(`  [5/6] requirement      ${f(newRoleRows.length)} inserted`);

  for (let i = 0; i < withRank.length; i += CB) {
    await db.insert(schema.task).values(
      withRank.slice(i, i + CB).map((a) => ({
        id: crypto.randomUUID(),
        companyCode: a.code,
        requirementId: null,
        userId: null,
        title: "First call — validate EDB requirement",
        dueDate: today,
        source: "new_requirement",
        status: "open",
        createdByInteraction: null,
        closedByInteraction: null,
        createdAt: now,
        closedAt: null,
      })) as never
    );
  }
  console.log(`  [6/6] task             ${f(withRank.length)} inserted`);

  const [[co], [rq]] = await Promise.all([
    raw.query(`SELECT COUNT(*)::int c FROM company`),
    raw.query(`SELECT COUNT(*)::int c FROM requirement`),
  ]);

  head("DONE");
  console.log(`  companies now  ${f(co.c).padStart(8)}`);
  console.log(`  roles now      ${f(rq.c).padStart(8)}`);
  console.log(`  batch id       ${batchId}\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
