import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import ExcelJS from "exceljs";

async function main() {
  const { db } = await import("../lib/db");
  const { company, requirement, qualificationMaster, contact } = await import("../lib/db/schema");
  const { eq, and, asc, desc, sql } = await import("drizzle-orm");
  const { districts } = await import("../lib/config/districts");

  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i]?.startsWith("--")) flags[args[i].slice(2)] = args[i + 1] || "";
  }

  console.log("Building backfill XLSX (5-sheet)...\n");

  // ── Fetch data ──
  const conditions: any[] = [];
  if (flags.tier) conditions.push(eq(company.tier, parseInt(flags.tier)));
  if (flags.district) conditions.push(eq(company.district, flags.district));

  const companyRows = await db
    .select()
    .from(company)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(company.tier), asc(company.companyRank));

  const companyCodes = companyRows.map((c) => c.companyCode);

  // Fetch requirements for these companies
  const reqRows = companyCodes.length > 0
    ? await db
        .select()
        .from(requirement)
        .where(sql`${requirement.companyCode} IN (${sql.join(companyCodes.map((c) => sql`${c}`), sql`, `)})`)
        .orderBy(asc(requirement.companyCode), asc(requirement.roleName))
    : [];

  // Fetch primary/first contact per company
  const contactRows = companyCodes.length > 0
    ? await db
        .select()
        .from(contact)
        .where(and(
          sql`${contact.companyCode} IN (${sql.join(companyCodes.map((c) => sql`${c}`), sql`, `)})`,
          eq(contact.valid, true)
        ))
        .orderBy(desc(contact.isPrimary), asc(contact.createdAt))
    : [];

  // Build contact lookup: first valid contact per company
  const contactMap = new Map<string, typeof contactRows[0]>();
  for (const c of contactRows) {
    if (!contactMap.has(c.companyCode)) contactMap.set(c.companyCode, c);
  }

  // Role count per company
  const roleCountMap = new Map<string, number>();
  for (const r of reqRows) {
    roleCountMap.set(r.companyCode, (roleCountMap.get(r.companyCode) || 0) + 1);
  }

  // Qualifications
  const qualRows = await db
    .select({ id: qualificationMaster.id, name: qualificationMaster.name })
    .from(qualificationMaster)
    .orderBy(asc(qualificationMaster.name));

  // Qual ID → name map
  const qualIdToName: Record<string, string> = {};
  qualRows.forEach((q) => { qualIdToName[q.id] = q.name; });

  console.log(`  ${companyRows.length} companies, ${reqRows.length} roles, ${qualRows.length} qualifications\n`);

  // ── Workbook ──
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kaushalam CRM";
  wb.created = new Date();

  // Shared styles
  const greyFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0EDEA" } };
  const greenFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F3EB" } };
  const statusFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
  const hdrGrey: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF620124" } };
  const hdrGreen: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E7B4E" } };
  const hdrOrange: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9601F" } };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD8D2CE" } },
    bottom: { style: "thin", color: { argb: "FFD8D2CE" } },
    left: { style: "thin", color: { argb: "FFD8D2CE" } },
    right: { style: "thin", color: { argb: "FFD8D2CE" } },
  };
  const whiteFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };

  // ═══ SHEET 1: Instructions ═══
  const instrSheet = wb.addWorksheet("Instructions");
  instrSheet.getColumn(1).width = 95;
  const instr = [
    ["BACKFILL SHEET — HOW TO USE", true, 16],
    [""],
    ["This workbook has 2 data sheets: Requests (one row per company) and Roles (one row per role).", false, 11],
    [""],
    ["STEP 1: Fill the REQUESTS sheet", true, 12],
    ["  • Grey columns (A–J) are READ-ONLY context — do not edit"],
    ["  • Green columns (K–S) are EDITABLE — fill based on your call"],
    ["  • Contact info (G–I) is pre-filled from the database. Read-only if present, editable if empty."],
    ["  • One row = one company = one call. Fill once per company."],
    [""],
    ["STEP 2: Fill the ROLES sheet", true, 12],
    ["  • Grey columns (A–H) are READ-ONLY context"],
    ["  • Green columns (I–W) are EDITABLE — fill per role"],
    ["  • Each row is one role for one company, linked by company_code"],
    ["  • For qualification, pick from the dropdown (see Qualification Master tab)"],
    [""],
    ["STEP 3: Check STATUS columns", true, 12],
    ["  • REQUEST STATUS (col T) and ROLE STATUS (col X) auto-calculate"],
    ["  • Pending (red) = nothing filled yet"],
    ["  • In Progress (amber) = partially filled"],
    ["  • Completed (green) = all required fields filled and valid"],
    ["  • Goal: all rows green before returning the sheet"],
    [""],
    ["MANDATORY FIELDS:", true, 12],
    ["  Requests: channel, disposition, comment, next_step, next_action_date"],
    ["  Roles: required_count_validated, qualification_1, experience_from, experience_to, classification, handoff_comment"],
    ["  If classification = collector → collector_district is also required"],
    [""],
    ["CLASSIFICATION GUIDE:", true, 12],
    ["  kaushalam  = Job-ready candidates → Scheduling for placement drive"],
    ["  collector  = Unskilled/semi-skilled → district Collector for local mobilisation"],
    ["  apssdc     = Needs training → APSSDC via EDB"],
    [""],
    ["Save as .xlsx and return to admin for import."],
  ];
  instr.forEach((line, i) => {
    const cell = instrSheet.getCell(`A${i + 1}`);
    cell.value = typeof line === "string" ? line : (line[0] as string);
    const bold = Array.isArray(line) && line[1];
    const sz = Array.isArray(line) && line[2] ? (line[2] as number) : 10;
    cell.font = { bold: !!bold, size: sz, name: "Calibri", color: bold && sz >= 14 ? { argb: "FF620124" } : undefined };
  });
  instrSheet.protect("kaushalam2026", { selectLockedCells: true, selectUnlockedCells: true });

  // ═══ SHEET 2: Masters (hidden) ═══
  const mastersSheet = wb.addWorksheet("Masters", { state: "veryHidden" });

  mastersSheet.getCell("A1").value = "Qualification";
  qualRows.forEach((q, i) => { mastersSheet.getCell(`A${i + 2}`).value = q.name; });

  mastersSheet.getCell("B1").value = "Qual_ID";
  qualRows.forEach((q, i) => { mastersSheet.getCell(`B${i + 2}`).value = q.id; });

  mastersSheet.getCell("C1").value = "District";
  districts.forEach((d, i) => { mastersSheet.getCell(`C${i + 2}`).value = d; });

  const classValues = ["kaushalam", "apssdc", "collector"];
  mastersSheet.getCell("D1").value = "Classification";
  classValues.forEach((c, i) => { mastersSheet.getCell(`D${i + 2}`).value = c; });

  const genderValues = ["Any", "Male", "Female"];
  mastersSheet.getCell("E1").value = "Gender";
  genderValues.forEach((g, i) => { mastersSheet.getCell(`E${i + 2}`).value = g; });

  const pwdValues = ["yes", "no"];
  mastersSheet.getCell("F1").value = "PWD";
  pwdValues.forEach((p, i) => { mastersSheet.getCell(`F${i + 2}`).value = p; });

  const statusValues = ["validated", "handed_over_scheduling", "handed_over_collector", "handed_over_apssdc", "no_requirement", "future", "not_operational", "do_not_call"];
  mastersSheet.getCell("G1").value = "Status";
  statusValues.forEach((s, i) => { mastersSheet.getCell(`G${i + 2}`).value = s; });

  const channelValues = ["call", "whatsapp", "email", "visit", "inbound"];
  mastersSheet.getCell("H1").value = "Channel";
  channelValues.forEach((c, i) => { mastersSheet.getCell(`H${i + 2}`).value = c; });

  const dispCodes = ["no_answer", "wrong_contact", "hiring_now", "hiring_later", "no_requirement", "not_operational", "do_not_call", "duplicate"];
  mastersSheet.getCell("I1").value = "Disposition";
  dispCodes.forEach((d, i) => { mastersSheet.getCell(`I${i + 2}`).value = d; });

  const timingValues = ["now", "later", "not_hiring"];
  mastersSheet.getCell("J1").value = "Timing";
  timingValues.forEach((t, i) => { mastersSheet.getCell(`J${i + 2}`).value = t; });

  const tagValues = ["Recurring requirement", "Continuous hiring", "Seasonal hiring", "High volume", "Priority account"];
  mastersSheet.getCell("K1").value = "Tags";
  tagValues.forEach((t, i) => { mastersSheet.getCell(`K${i + 2}`).value = t; });

  // ═══ SHEET 3: Requests ═══
  const reqSheet = wb.addWorksheet("Requests");

  const reqCols: Partial<ExcelJS.Column>[] = [
    { header: "company_code", key: "companyCode", width: 18 },
    { header: "company_name", key: "companyName", width: 35 },
    { header: "district", key: "district", width: 18 },
    { header: "sector", key: "sectors", width: 28 },
    { header: "tier", key: "tier", width: 6 },
    { header: "total_roles", key: "totalRoles", width: 10 },
    { header: "contact_name", key: "contactName", width: 22 },
    { header: "contact_mobile", key: "contactMobile", width: 14 },
    { header: "contact_designation", key: "contactDesignation", width: 18 },
    { header: "contact_id", key: "contactId", width: 10 },
    // Editable K–S
    { header: "channel *", key: "channel", width: 14 },
    { header: "disposition *", key: "disposition", width: 18 },
    { header: "disposition_reason", key: "dispositionReason", width: 22 },
    { header: "timing", key: "timing", width: 14 },
    { header: "timing_date", key: "timingDate", width: 14 },
    { header: "comment *", key: "comment", width: 50 },
    { header: "next_step *", key: "nextStep", width: 40 },
    { header: "next_action_date *", key: "nextActionDate", width: 16 },
    { header: "tags", key: "tags", width: 30 },
    // Status
    { header: "REQUEST STATUS", key: "requestStatus", width: 16 },
  ];
  reqSheet.columns = reqCols;

  // Header
  const rhr = reqSheet.getRow(1);
  rhr.height = 28;
  rhr.font = whiteFont;
  rhr.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= 20; c++) {
    const cell = rhr.getCell(c);
    cell.fill = c <= 10 ? hdrGrey : c <= 19 ? hdrGreen : hdrOrange;
    cell.border = border;
  }

  reqSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1, topLeftCell: "A2" }];

  // Data rows
  companyRows.forEach((co) => {
    const ct = contactMap.get(co.companyCode);
    const hasContact = !!(ct?.name || ct?.mobile);

    const row = reqSheet.addRow({
      companyCode: co.companyCode,
      companyName: co.companyName,
      district: co.district ?? "",
      sectors: co.sectors ?? "",
      tier: co.tier,
      totalRoles: roleCountMap.get(co.companyCode) ?? 0,
      contactName: ct?.name ?? "",
      contactMobile: ct?.mobile ?? "",
      contactDesignation: ct?.designation ?? "",
      contactId: ct?.id ?? "",
      channel: "",
      disposition: "",
      dispositionReason: "",
      timing: "",
      timingDate: "",
      comment: "",
      nextStep: "",
      nextActionDate: "",
      tags: "",
      requestStatus: "",
    });

    row.font = { size: 10, name: "Calibri" };
    row.alignment = { vertical: "top" };

    // A–F: always locked
    for (let c = 1; c <= 6; c++) {
      row.getCell(c).fill = greyFill;
      row.getCell(c).border = border;
      row.getCell(c).protection = { locked: true };
    }
    // G–I: contact — locked if present, editable if empty
    for (let c = 7; c <= 9; c++) {
      row.getCell(c).fill = hasContact ? greyFill : greenFill;
      row.getCell(c).border = border;
      row.getCell(c).protection = { locked: hasContact };
    }
    // J: contact_id — always locked, hidden-ish
    row.getCell(10).fill = greyFill;
    row.getCell(10).border = border;
    row.getCell(10).protection = { locked: true };
    row.getCell(10).font = { size: 8, color: { argb: "FFA0A0A0" }, name: "Calibri" };
    // K–S: editable
    for (let c = 11; c <= 19; c++) {
      row.getCell(c).fill = greenFill;
      row.getCell(c).border = border;
      row.getCell(c).protection = { locked: false };
    }
    // T: status formula
    row.getCell(20).fill = statusFill;
    row.getCell(20).border = border;
    row.getCell(20).protection = { locked: true };
  });

  const rlr = companyRows.length + 1; // last row

  // REQUEST STATUS formula (col T)
  for (let r = 2; r <= rlr; r++) {
    const anyFilled = `OR(K${r}<>"",L${r}<>"",M${r}<>"",N${r}<>"",O${r}<>"",P${r}<>"",Q${r}<>"",R${r}<>"",S${r}<>"")`;
    const allMandatory = `AND(K${r}<>"",L${r}<>"",P${r}<>"",Q${r}<>"",R${r}<>"")`;
    reqSheet.getCell(`T${r}`).value = {
      formula: `IF(${allMandatory},"Completed",IF(${anyFilled},"In Progress","Pending"))`,
    } as ExcelJS.CellFormulaValue;
    reqSheet.getCell(`T${r}`).font = { size: 10, name: "Calibri", bold: true };
  }

  // Validations — Requests
  reqSheet.dataValidations.add(`K2:K${rlr}`, { type: "list", formulae: [`Masters!$H$2:$H$${channelValues.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "Select from dropdown", errorStyle: "stop" as any });
  reqSheet.dataValidations.add(`L2:L${rlr}`, { type: "list", formulae: [`Masters!$I$2:$I$${dispCodes.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "Select from dropdown", errorStyle: "stop" as any });
  reqSheet.dataValidations.add(`M2:M${rlr}`, { type: "textLength", operator: "lessThanOrEqual", formulae: [500], showErrorMessage: true, errorTitle: "Too long", error: "Max 500 chars", errorStyle: "stop" as any });
  reqSheet.dataValidations.add(`N2:N${rlr}`, { type: "list", formulae: [`Masters!$J$2:$J$${timingValues.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "Select from dropdown", errorStyle: "stop" as any });
  reqSheet.dataValidations.add(`P2:P${rlr}`, { type: "textLength", operator: "lessThanOrEqual", formulae: [5000], showErrorMessage: true, errorTitle: "Too long", error: "Max 5000 chars", errorStyle: "stop" as any });
  reqSheet.dataValidations.add(`Q2:Q${rlr}`, { type: "textLength", operator: "lessThanOrEqual", formulae: [500], showErrorMessage: true, errorTitle: "Too long", error: "Max 500 chars", errorStyle: "stop" as any });

  // Conditional formatting — Requests
  reqSheet.addConditionalFormatting({ ref: `T2:T${rlr}`, rules: [
    { type: "cellIs", operator: "equal", formulae: ['"Completed"'], style: { font: { color: { argb: "FF1E7B4E" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F3EB" } } }, priority: 1 },
    { type: "cellIs", operator: "equal", formulae: ['"In Progress"'], style: { font: { color: { argb: "FF9A6A12" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBF1DC" } } }, priority: 2 },
    { type: "cellIs", operator: "equal", formulae: ['"Pending"'], style: { font: { color: { argb: "FFB42318" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 3 },
  ]});

  // Red on mandatory when other fields filled
  ["K", "L", "P", "Q", "R"].forEach((col, idx) => {
    reqSheet.addConditionalFormatting({ ref: `${col}2:${col}${rlr}`, rules: [
      { type: "expression", formulae: [`AND(T${2}="In Progress",${col}2="")`], style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 10 + idx },
    ]});
  });

  reqSheet.autoFilter = { from: "A1", to: "T1" };
  await reqSheet.protect("kaushalam2026", { selectLockedCells: true, selectUnlockedCells: true, sort: true, autoFilter: true });

  // ═══ SHEET 4: Roles ═══
  const rolesSheet = wb.addWorksheet("Roles");

  const roleCols: Partial<ExcelJS.Column>[] = [
    { header: "company_code", key: "companyCode", width: 18 },
    { header: "company_name", key: "companyName", width: 30 },
    { header: "requirement_id", key: "requirementId", width: 38 },
    { header: "role_name", key: "roleName", width: 30 },
    { header: "required_count", key: "requiredCount", width: 14 },
    { header: "required_within_months", key: "requiredWithinMonths", width: 12 },
    { header: "skills", key: "skills", width: 35 },
    { header: "is_custom", key: "isCustom", width: 8 },
    // Editable I–W
    { header: "role_name_edited", key: "roleNameEdited", width: 25 },
    { header: "required_count_validated *", key: "requiredCountValidated", width: 18 },
    { header: "qualification_1 *", key: "qualification1", width: 28 },
    { header: "qualification_2", key: "qualification2", width: 28 },
    { header: "qualification_3", key: "qualification3", width: 28 },
    { header: "experience_from *", key: "experienceFrom", width: 14 },
    { header: "experience_to *", key: "experienceTo", width: 14 },
    { header: "gender_preference", key: "genderPreference", width: 16 },
    { header: "age_limit", key: "ageLimit", width: 10 },
    { header: "salary", key: "salary", width: 12 },
    { header: "pwd", key: "pwd", width: 8 },
    { header: "classification *", key: "classification", width: 16 },
    { header: "collector_district", key: "collectorDistrict", width: 22 },
    { header: "handoff_comment *", key: "handoffComment", width: 45 },
    { header: "new_status", key: "newStatus", width: 22 },
    // Status
    { header: "ROLE STATUS", key: "roleStatus", width: 14 },
  ];
  rolesSheet.columns = roleCols;

  const roleHdr = rolesSheet.getRow(1);
  roleHdr.height = 28;
  roleHdr.font = whiteFont;
  roleHdr.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= 24; c++) {
    roleHdr.getCell(c).fill = c <= 8 ? hdrGrey : c <= 23 ? hdrGreen : hdrOrange;
    roleHdr.getCell(c).border = border;
  }

  rolesSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1, topLeftCell: "A2" }];

  function qualPart(qual: string | null, idx: number): string {
    if (!qual) return "";
    const parts = qual.split(";").map((s) => s.trim()).filter(Boolean);
    const id = parts[idx];
    if (!id) return "";
    return qualIdToName[id] || id;
  }

  reqRows.forEach((r) => {
    const co = companyRows.find((c) => c.companyCode === r.companyCode);
    const row = rolesSheet.addRow({
      companyCode: r.companyCode,
      companyName: co?.companyName ?? "",
      requirementId: r.id,
      roleName: r.roleName,
      requiredCount: r.requiredCount,
      requiredWithinMonths: r.requiredWithinMonths,
      skills: r.skills ?? "",
      isCustom: r.isCustom ? "yes" : "no",
      roleNameEdited: r.roleNameEdited ?? "",
      requiredCountValidated: r.requiredCountValidated != null ? r.requiredCountValidated : "",
      qualification1: qualPart(r.qualification, 0),
      qualification2: qualPart(r.qualification, 1),
      qualification3: qualPart(r.qualification, 2),
      experienceFrom: r.experienceFrom != null ? r.experienceFrom : "",
      experienceTo: r.experienceTo != null ? r.experienceTo : "",
      genderPreference: r.genderPreference ?? "",
      ageLimit: r.ageLimit ?? "",
      salary: r.salary ?? "",
      pwd: r.pwd ? "yes" : "",
      classification: r.classification ?? "",
      collectorDistrict: r.collectorDistrict ?? "",
      handoffComment: r.handoffComment ?? "",
      newStatus: "",
      roleStatus: "",
    });

    row.font = { size: 10, name: "Calibri" };
    row.alignment = { vertical: "top" };

    for (let c = 1; c <= 8; c++) {
      row.getCell(c).fill = greyFill;
      row.getCell(c).border = border;
      row.getCell(c).protection = { locked: true };
    }
    for (let c = 9; c <= 23; c++) {
      row.getCell(c).fill = greenFill;
      row.getCell(c).border = border;
      row.getCell(c).protection = { locked: false };
    }
    row.getCell(24).fill = statusFill;
    row.getCell(24).border = border;
    row.getCell(24).protection = { locked: true };
  });

  const rllr = reqRows.length + 1;

  // ROLE STATUS formula (col X)
  for (let r = 2; r <= rllr; r++) {
    const anyFilled = `OR(I${r}<>"",J${r}<>"",K${r}<>"",L${r}<>"",M${r}<>"",N${r}<>"",O${r}<>"",P${r}<>"",Q${r}<>"",R${r}<>"",S${r}<>"",T${r}<>"",U${r}<>"",V${r}<>"",W${r}<>"")`;
    const allMandatory = `AND(J${r}<>"",K${r}<>"",N${r}<>"",O${r}<>"",T${r}<>"",V${r}<>"")`;
    const expValid = `OR(AND(N${r}="",O${r}=""),O${r}>=N${r})`;
    const collectorOk = `OR(T${r}<>"collector",U${r}<>"")`;

    rolesSheet.getCell(`X${r}`).value = {
      formula: `IF(AND(${allMandatory},${expValid},${collectorOk}),"Completed",IF(${anyFilled},"In Progress","Pending"))`,
    } as ExcelJS.CellFormulaValue;
    rolesSheet.getCell(`X${r}`).font = { size: 10, name: "Calibri", bold: true };
  }

  // Validations — Roles
  const qf = `Masters!$A$2:$A$${qualRows.length + 1}`;
  rolesSheet.dataValidations.add(`I2:I${rllr}`, { type: "textLength", operator: "lessThanOrEqual", formulae: [200], showErrorMessage: true, errorTitle: "Too long", error: "Max 200 chars", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`J2:J${rllr}`, { type: "whole", operator: "between", formulae: [0, 99999], showErrorMessage: true, errorTitle: "Invalid", error: "Whole number 0–99,999", errorStyle: "stop" as any });
  for (const col of ["K", "L", "M"]) {
    rolesSheet.dataValidations.add(`${col}2:${col}${rllr}`, { type: "list", formulae: [qf], showErrorMessage: true, errorTitle: "Invalid", error: "Pick from dropdown", errorStyle: "stop" as any });
  }
  rolesSheet.dataValidations.add(`N2:N${rllr}`, { type: "whole", operator: "between", formulae: [0, 15], showErrorMessage: true, errorTitle: "Invalid", error: "0–15", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`O2:O${rllr}`, { type: "whole", operator: "between", formulae: [0, 15], showErrorMessage: true, errorTitle: "Invalid", error: "0–15, must be ≥ from", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`P2:P${rllr}`, { type: "list", formulae: [`Masters!$E$2:$E$${genderValues.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "Any/Male/Female", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`Q2:Q${rllr}`, { type: "whole", operator: "between", formulae: [18, 65], showErrorMessage: true, errorTitle: "Invalid", error: "18–65", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`R2:R${rllr}`, { type: "whole", operator: "between", formulae: [0, 9999999], showErrorMessage: true, errorTitle: "Invalid", error: "0–99,99,999", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`S2:S${rllr}`, { type: "list", formulae: [`Masters!$F$2:$F$${pwdValues.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "yes/no", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`T2:T${rllr}`, { type: "list", formulae: [`Masters!$D$2:$D$${classValues.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "kaushalam/apssdc/collector", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`U2:U${rllr}`, { type: "list", formulae: [`Masters!$C$2:$C$${districts.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "Select district", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`V2:V${rllr}`, { type: "textLength", operator: "lessThanOrEqual", formulae: [2000], showErrorMessage: true, errorTitle: "Too long", error: "Max 2000 chars", errorStyle: "stop" as any });
  rolesSheet.dataValidations.add(`W2:W${rllr}`, { type: "list", formulae: [`Masters!$G$2:$G$${statusValues.length + 1}`], showErrorMessage: true, errorTitle: "Invalid", error: "Select from dropdown", errorStyle: "stop" as any });

  // Conditional formatting — Roles
  rolesSheet.addConditionalFormatting({ ref: `X2:X${rllr}`, rules: [
    { type: "cellIs", operator: "equal", formulae: ['"Completed"'], style: { font: { color: { argb: "FF1E7B4E" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F3EB" } } }, priority: 1 },
    { type: "cellIs", operator: "equal", formulae: ['"In Progress"'], style: { font: { color: { argb: "FF9A6A12" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBF1DC" } } }, priority: 2 },
    { type: "cellIs", operator: "equal", formulae: ['"Pending"'], style: { font: { color: { argb: "FFB42318" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 3 },
  ]});

  rolesSheet.addConditionalFormatting({ ref: `O2:O${rllr}`, rules: [
    { type: "expression", formulae: ['AND(O2<>"",N2<>"",O2<N2)'], style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 10 },
  ]});
  rolesSheet.addConditionalFormatting({ ref: `U2:U${rllr}`, rules: [
    { type: "expression", formulae: ['AND(T2="collector",U2="")'], style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 11 },
  ]});

  ["J", "K", "N", "O", "T", "V"].forEach((col, idx) => {
    rolesSheet.addConditionalFormatting({ ref: `${col}2:${col}${rllr}`, rules: [
      { type: "expression", formulae: [`AND(X${2}="In Progress",${col}2="")`], style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 20 + idx },
    ]});
  });

  rolesSheet.autoFilter = { from: "A1", to: "X1" };
  await rolesSheet.protect("kaushalam2026", { selectLockedCells: true, selectUnlockedCells: true, sort: true, autoFilter: true });

  // ═══ SHEET 5: Qualification Master ═══
  const qualSheet = wb.addWorksheet("Qualification Master");
  qualSheet.columns = [
    { header: "Qualification Name", key: "name", width: 40 },
    { header: "UUID", key: "id", width: 40 },
  ];
  const qhr = qualSheet.getRow(1);
  qhr.font = whiteFont;
  qhr.fill = hdrGrey;
  qualRows.forEach((q) => qualSheet.addRow({ name: q.name, id: q.id }));
  qualSheet.protect("kaushalam2026", { selectLockedCells: true, selectUnlockedCells: true });

  // ═══ Save ═══
  const today = new Date().toISOString().split("T")[0];
  const suffix = flags.tier ? `-tier${flags.tier}` : flags.district ? `-${flags.district}` : "";
  const outPath = `data/backfill-export-${today}${suffix}.xlsx`;
  await wb.xlsx.writeFile(outPath);

  console.log(`✓ Exported to ${outPath}`);
  console.log(`  Requests: ${companyRows.length} companies`);
  console.log(`  Roles: ${reqRows.length} requirements`);
  console.log(`  Qualifications: ${qualRows.length} (incl. 10th Class, Intermediate)`);
  console.log(`  Sheets: Instructions, Requests, Roles, Qualification Master, Masters (hidden)`);
  process.exit(0);
}

main().catch((err) => { console.error("Export failed:", err); process.exit(1); });
