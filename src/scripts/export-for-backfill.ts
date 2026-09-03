import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { writeFileSync } from "fs";

async function main() {
  const { db } = await import("../lib/db");
  const { company, requirement, contact } = await import("../lib/db/schema");
  const { eq, and, asc, sql } = await import("drizzle-orm");

  // Parse CLI args
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith("--")) flags[args[i].slice(2)] = args[i + 1] || "";
  }

  console.log("\nExporting requirements for backfill...\n");

  // Build conditions
  const conditions = [];
  if (flags.tier) {
    conditions.push(eq(company.tier, parseInt(flags.tier)));
  }
  if (flags.status) {
    conditions.push(eq(requirement.status, flags.status));
  }
  if (flags.district) {
    conditions.push(eq(company.district, flags.district));
  }

  const rows = await db
    .select({
      companyCode: company.companyCode,
      companyName: company.companyName,
      district: company.district,
      sector: company.sector,
      tier: company.tier,
      requirementId: requirement.id,
      referenceId: requirement.referenceId,
      roleName: requirement.roleName,
      requiredCount: requirement.requiredCount,
      requiredWithinMonths: requirement.requiredWithinMonths,
      skills: requirement.skills,
      currentStatus: requirement.status,
      requiredCountValidated: requirement.requiredCountValidated,
      qualification: requirement.qualification,
      experienceFrom: requirement.experienceFrom,
      experienceTo: requirement.experienceTo,
      genderPreference: requirement.genderPreference,
      ageLimit: requirement.ageLimit,
      salary: requirement.salary,
      pwd: requirement.pwd,
      classification: requirement.classification,
      collectorDistrict: requirement.collectorDistrict,
      handoffComment: requirement.handoffComment,
    })
    .from(requirement)
    .innerJoin(company, eq(requirement.companyCode, company.companyCode))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(company.tier), asc(company.companyRank), asc(requirement.roleName));

  if (rows.length === 0) {
    console.log("No requirements match the filters.");
    process.exit(0);
  }

  // Build CSV
  const headers = [
    "company_code", "company_name", "district", "sector", "tier",
    "requirement_id", "reference_id", "role_name", "required_count",
    "required_within_months", "skills", "current_status",
    "required_count_validated", "qualification", "experience_from",
    "experience_to", "gender_preference", "age_limit", "salary", "pwd",
    "classification", "collector_district", "handoff_comment", "new_status",
  ];

  function escapeCsv(val: unknown): string {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const csvRows = [headers.join(",")];
  for (const r of rows) {
    csvRows.push([
      r.companyCode,
      r.companyName,
      r.district,
      r.sector,
      r.tier,
      r.requirementId,
      r.referenceId,
      r.roleName,
      r.requiredCount,
      r.requiredWithinMonths,
      r.skills,
      r.currentStatus,
      r.requiredCountValidated ?? "",
      r.qualification ?? "",
      r.experienceFrom ?? "",
      r.experienceTo ?? "",
      r.genderPreference ?? "",
      r.ageLimit ?? "",
      r.salary ?? "",
      r.pwd ? "yes" : "",
      r.classification ?? "",
      r.collectorDistrict ?? "",
      r.handoffComment ?? "",
      "",
    ].map(escapeCsv).join(","));
  }

  const today = new Date().toISOString().split("T")[0];
  const suffix = flags.tier ? `-tier${flags.tier}` : flags.status ? `-${flags.status}` : "";
  const outPath = `data/backfill-export-${today}${suffix}.csv`;

  writeFileSync(outPath, csvRows.join("\n"), "utf-8");

  console.log(`Exported ${rows.length} requirements to ${outPath}`);
  console.log(`  Companies: ${new Set(rows.map((r) => r.companyCode)).size}`);
  if (flags.tier) console.log(`  Filter: tier = ${flags.tier}`);
  if (flags.status) console.log(`  Filter: status = ${flags.status}`);
  if (flags.district) console.log(`  Filter: district = ${flags.district}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
