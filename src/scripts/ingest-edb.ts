import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

async function main() {
  const filePath = process.argv[2] || "./data/Skill_Requirement_Data_27_Aug.csv";
  const extractDate = process.argv[3] || "2026-08-27";

  const { db } = await import("../lib/db");
  const schema = await import("../lib/db/schema");
  const { eq, sql } = await import("drizzle-orm");

  console.log(`\nIngesting EDB extract: ${filePath}`);
  console.log(`Extract date: ${extractDate}\n`);

  // ── Parse CSV ──
  const raw = readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const rows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  console.log(`Parsed ${rows.length} CSV rows.\n`);

  const now = new Date().toISOString();
  const today = now.split("T")[0];
  const batchId = crypto.randomUUID();

  // ── 1. Create import batch ──
  await db.insert(schema.importBatch).values({
    id: batchId,
    sourceFile: filePath.split("/").pop() || filePath,
    extractDate,
    importedAt: now,
    importedBy: "ingest-script",
    rowCount: rows.length,
    notes: "Initial EDB load",
  });
  console.log(`[1/7] Import batch created: ${batchId}`);

  // ── 2. Insert edb_raw (append-only snapshot) ──
  const EDB_RAW_BATCH = 500;
  for (let i = 0; i < rows.length; i += EDB_RAW_BATCH) {
    const batch = rows.slice(i, i + EDB_RAW_BATCH).map((row, idx) => ({
      id: crypto.randomUUID(),
      batchId,
      rowNo: i + idx + 1,
      referenceId: row.reference_id || null,
      companyCode: row.company_code || null,
      roleName: row.role_name || null,
      rowJson: JSON.stringify(row),
    }));
    await db.insert(schema.edbRaw).values(batch);
  }
  console.log(`[2/7] edb_raw: ${rows.length} rows inserted.`);

  // ── 3. Aggregate companies ──
  type CompanyAgg = {
    companyCode: string;
    companyName: string;
    legalName: string;
    gstin: string;
    pan: string;
    sector: string;
    sectors: string;
    subsectors: string;
    lineOfActivity: string;
    plantLocation: string;
    district: string;
    mandal: string;
    village: string;
    stage: string;
    udyamNumber: string;
    projectName: string;
    maxHeadcount: number;
    totalRequired: number;
    roleCount: number;
    flags: Set<string>;
    contactKey: string;
    submitterName: string;
    submitterDesignation: string;
    submitterMobile: string;
    submitterEmail: string;
  };

  const companyMap = new Map<string, CompanyAgg>();

  for (const row of rows) {
    const code = row.company_code;
    if (!code) continue;

    const headcount = parseInt(row.present_headcount) || 0;
    const reqCount = parseInt(row.required_count) || 0;
    const withinMonths = parseInt(row.required_within_months) || 0;

    let co = companyMap.get(code);
    if (!co) {
      co = {
        companyCode: code,
        companyName: row.company_name || code,
        legalName: row.company_legal_name || "",
        gstin: row.company_gstin || "",
        pan: row.company_pan || "",
        sector: row.company_sector || "",
        sectors: row.sectors || "",
        subsectors: row.subsectors || "",
        lineOfActivity: row.company_line_of_activity || "",
        plantLocation: row.company_plant_location || "",
        district: row.company_district_name || "",
        mandal: row.company_mandal || "",
        village: row.company_village || "",
        stage: row.company_stage || "",
        udyamNumber: row.company_udyam_number || "",
        projectName: row.project_name || "",
        maxHeadcount: headcount,
        totalRequired: 0,
        roleCount: 0,
        flags: new Set<string>(),
        contactKey: "",
        submitterName: row.submitter_name || "",
        submitterDesignation: row.submitter_designation || "",
        submitterMobile: row.submitter_mobile || "",
        submitterEmail: row.submitter_email || "",
      };
      companyMap.set(code, co);
    }

    co.maxHeadcount = Math.max(co.maxHeadcount, headcount);
    co.totalRequired += reqCount;
    co.roleCount++;

    // Contact de-dup: keep first with a mobile
    const mobile = normalizeMobile(row.submitter_mobile);
    if (!co.contactKey && mobile) {
      co.contactKey = mobile;
      co.submitterName = row.submitter_name || co.submitterName;
      co.submitterDesignation = row.submitter_designation || co.submitterDesignation;
      co.submitterMobile = row.submitter_mobile || co.submitterMobile;
      co.submitterEmail = row.submitter_email || co.submitterEmail;
    }

    // Flags
    const name = (row.company_name || "").toLowerCase();
    if (/^(test|abc|xyz|sample|dummy)/i.test(name)) co.flags.add("test_record");
    if (!mobile && !row.submitter_email) co.flags.add("no_working_contact");
    if (row.company_district_name === "") co.flags.add("district_missing");
    if (co.gstin && !isValidGSTIN(co.gstin)) co.flags.add("gstin_format_invalid");
  }

  // Rank and tier
  const sorted = Array.from(companyMap.values()).sort(
    (a, b) => b.totalRequired - a.totalRequired || a.companyCode.localeCompare(b.companyCode)
  );
  sorted.forEach((co, idx) => {
    const rank = idx + 1;
    (co as CompanyAgg & { rank: number; tier: number }).rank = rank;
    (co as CompanyAgg & { rank: number; tier: number }).tier =
      rank <= 300 ? 1 : rank <= 1000 ? 2 : rank <= 2843 ? 3 : 4;
  });

  // GSTIN dupes
  const gstinMap = new Map<string, string[]>();
  for (const co of sorted) {
    if (co.gstin) {
      const existing = gstinMap.get(co.gstin) || [];
      existing.push(co.companyCode);
      gstinMap.set(co.gstin, existing);
    }
  }
  for (const [, codes] of gstinMap) {
    if (codes.length > 1) {
      for (const code of codes) {
        companyMap.get(code)?.flags.add("gstin_shared_by_multiple_codes");
      }
    }
  }

  // Requirement-level flags
  const reqFlags = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = `${row.reference_id}|${row.role_name}|${row.created_at}`;
    const flags = new Set<string>();
    const reqCount = parseInt(row.required_count) || 0;
    const withinMonths = parseInt(row.required_within_months) || 0;
    const headcount = parseInt(row.present_headcount) || 0;

    if (withinMonths >= 120) flags.add("timeline_default_120m");
    if (reqCount === 0) flags.add("required_count_missing");
    if (reqCount >= 3 * headcount && headcount >= 10) flags.add("outlier_high_vs_headcount");
    if (row.is_custom === "true") flags.add("custom_role_title");

    if (flags.size > 0) reqFlags.set(key, flags);
  }

  console.log(`[3/7] Aggregated ${companyMap.size} unique companies.`);

  // ── 4. Insert companies ──
  const CO_BATCH = 200;
  const sortedCompanies = sorted as (CompanyAgg & { rank: number; tier: number })[];
  let companyInserted = 0;

  for (let i = 0; i < sortedCompanies.length; i += CO_BATCH) {
    const batch = sortedCompanies.slice(i, i + CO_BATCH).map((co) => ({
      companyCode: co.companyCode,
      companyName: co.companyName,
      legalName: co.legalName || null,
      gstin: co.gstin || null,
      pan: co.pan || null,
      udyamNumber: co.udyamNumber || null,
      sector: co.sector || null,
      sectors: co.sectors || null,
      subsectors: co.subsectors || null,
      lineOfActivity: co.lineOfActivity || null,
      plantLocation: co.plantLocation || null,
      district: co.district || null,
      mandal: co.mandal || null,
      village: co.village || null,
      stage: co.stage || null,
      projectName: co.projectName || null,
      presentHeadcount: co.maxHeadcount,
      totalRequired: co.totalRequired,
      companyRank: co.rank,
      tier: co.tier,
      flags: co.flags.size > 0 ? Array.from(co.flags).join(";") : null,
      tags: null,
      lastDisposition: null,
      lastContactAt: null,
      contactCount: 0,
      firstSeenBatch: batchId,
      lastSeenBatch: batchId,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(schema.company).values(batch).onConflictDoNothing();
    companyInserted += batch.length;
  }
  console.log(`[4/7] company: ${companyInserted} rows inserted.`);

  // ── 5. Insert contacts (one per company, de-duped on mobile) ──
  const seenMobiles = new Set<string>();
  let contactInserted = 0;

  for (let i = 0; i < sortedCompanies.length; i += CO_BATCH) {
    const batch = sortedCompanies
      .slice(i, i + CO_BATCH)
      .filter((co) => co.submitterName || co.submitterMobile || co.submitterEmail)
      .map((co) => {
        const mobile = normalizeMobile(co.submitterMobile);
        const dedupeKey = mobile || co.submitterEmail || co.submitterName;
        if (seenMobiles.has(dedupeKey)) return null;
        seenMobiles.add(dedupeKey);

        return {
          id: crypto.randomUUID(),
          companyCode: co.companyCode,
          name: co.submitterName || null,
          designation: co.submitterDesignation || null,
          mobileRaw: co.submitterMobile || null,
          mobile: mobile && mobile.length === 10 ? mobile : null,
          email: co.submitterEmail || null,
          pocFor: "requirement",
          source: "edb",
          referenceId: null,
          isPrimary: true,
          valid: true,
          createdAt: now,
          createdBy: "ingest-script",
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (batch.length > 0) {
      await db.insert(schema.contact).values(batch as never);
      contactInserted += batch.length;
    }
  }
  console.log(`[5/7] contact: ${contactInserted} rows inserted.`);

  // ── 6. Insert requirements (one per CSV row) ──
  const REQ_BATCH = 500;
  let reqInserted = 0;

  for (let i = 0; i < rows.length; i += REQ_BATCH) {
    const batch = rows.slice(i, i + REQ_BATCH).map((row) => {
      const key = `${row.reference_id}|${row.role_name}|${row.created_at}`;
      const flags = reqFlags.get(key);

      return {
        id: crypto.randomUUID(),
        companyCode: row.company_code,
        referenceId: row.reference_id || "",
        edbRowId: null,
        roleName: row.role_name || "Unknown",
        isCustom: row.is_custom === "true",
        currentEmployment: parseInt(row.current_employment) || null,
        requiredCount: parseInt(row.required_count) || null,
        requiredWithinMonths: parseInt(row.required_within_months) || null,
        skills: row.skills || null,
        createdAtEdb: row.created_at || null,
        roleNameEdited: null,
        standardRole: null,
        requiredCountValidated: null,
        timing: null,
        timingDate: null,
        qualification: null,
        experience: null,
        genderPreference: null,
        ageLimit: null,
        salary: null,
        shift: null,
        monthlyIntake: null,
        needTraining: false,
        qpCode: null,
        classification: null,
        collectorDistrict: null,
        status: "captured",
        handoffComment: null,
        handedOverAt: null,
        handedOverBy: null,
        comment: null,
        flags: flags ? Array.from(flags).join(";") : null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: "edb",
      };
    });

    await db.insert(schema.requirement).values(batch as never).onConflictDoNothing();
    reqInserted += batch.length;
  }
  console.log(`[6/7] requirement: ${reqInserted} rows inserted.`);

  // ── 7. Create "First call" tasks (one per company, unassigned) ──
  let taskInserted = 0;
  for (let i = 0; i < sortedCompanies.length; i += CO_BATCH) {
    const batch = sortedCompanies.slice(i, i + CO_BATCH).map((co) => ({
      id: crypto.randomUUID(),
      companyCode: co.companyCode,
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
    }));

    await db.insert(schema.task).values(batch as never);
    taskInserted += batch.length;
  }
  console.log(`[7/7] task: ${taskInserted} first-call tasks created.\n`);

  // ── Update batch stats ──
  await db
    .update(schema.importBatch)
    .set({
      companyCount: companyMap.size,
      requirementCount: rows.length,
    })
    .where(eq(schema.importBatch.id, batchId));

  // ── Summary ──
  const tierCounts = [0, 0, 0, 0];
  for (const co of sortedCompanies) tierCounts[co.tier - 1]++;

  console.log("═══════════════════════════════════════");
  console.log("  INGESTION COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`  CSV rows:        ${rows.length.toLocaleString()}`);
  console.log(`  Companies:       ${companyMap.size.toLocaleString()}`);
  console.log(`  Contacts:        ${contactInserted.toLocaleString()}`);
  console.log(`  Requirements:    ${reqInserted.toLocaleString()}`);
  console.log(`  First-call tasks: ${taskInserted.toLocaleString()}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Tier 1 (rank 1-300):     ${tierCounts[0]}`);
  console.log(`  Tier 2 (rank 301-1000):  ${tierCounts[1]}`);
  console.log(`  Tier 3 (rank 1001-2843): ${tierCounts[2]}`);
  console.log(`  Tier 4 (rank 2844+):     ${tierCounts[3]}`);
  console.log("═══════════════════════════════════════\n");

  process.exit(0);
}

function normalizeMobile(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return null;
}

function isValidGSTIN(gstin: string): boolean {
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(gstin);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
