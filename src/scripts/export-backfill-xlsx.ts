import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import ExcelJS from "exceljs";

async function main() {
  const { db } = await import("../lib/db");
  const { company, requirement, qualificationMaster } = await import("../lib/db/schema");
  const { eq, and, asc } = await import("drizzle-orm");
  const { districts } = await import("../lib/config/districts");

  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i]?.startsWith("--")) flags[args[i].slice(2)] = args[i + 1] || "";
  }

  console.log("Building backfill XLSX...\n");

  const conditions = [];
  if (flags.tier) conditions.push(eq(company.tier, parseInt(flags.tier)));
  if (flags.status) conditions.push(eq(requirement.status, flags.status));
  if (flags.district) conditions.push(eq(company.district, flags.district));

  const rows = await db
    .select({
      companyCode: company.companyCode,
      companyName: company.companyName,
      district: company.district,
      sectors: company.sectors,
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

  const qualRows = await db
    .select({ id: qualificationMaster.id, name: qualificationMaster.name })
    .from(qualificationMaster)
    .orderBy(asc(qualificationMaster.name));

  console.log(`  ${rows.length} requirements, ${qualRows.length} qualifications loaded.\n`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kaushalam CRM";
  wb.created = new Date();

  // ═══ Instructions (Tab 1) ═══
  const instrSheet = wb.addWorksheet("Instructions");
  instrSheet.getColumn(1).width = 90;
  const instr = [
    ["BACKFILL SHEET — HOW TO USE", true, 14],
    [""],
    ["COLUMNS A–L (grey) are READ-ONLY. Do not edit.", true, 11],
    ["COLUMNS M–Y (green) are EDITABLE. Fill based on your call.", true, 11],
    ["Column Y (Row Status) auto-calculates. Do not edit.", true, 11],
    [""],
    ["FILLING GUIDE:"],
    ["  • required_count_validated — whole number, 0–99999"],
    ["  • qualification_1/2/3 — pick from dropdown (up to 3 qualifications per role)"],
    ["  • experience_from / experience_to — whole number 0–15, 'to' must be ≥ 'from'"],
    ["  • gender_preference — dropdown: Any / Male / Female"],
    ["  • age_limit — whole number, 18–65"],
    ["  • salary — whole number, monthly ₹, 0–9999999"],
    ["  • pwd — dropdown: yes / no"],
    ["  • classification — dropdown: kaushalam / apssdc / collector"],
    ["  • collector_district — dropdown (required if classification = collector)"],
    ["  • handoff_comment — text, max 2000 chars"],
    ["  • new_status — dropdown"],
    [""],
    ["CLASSIFICATION:", true, 11],
    ["  kaushalam  = Job-ready candidates → Scheduling team for placement drive"],
    ["  collector  = Unskilled/semi-skilled → district Collector for local mobilisation"],
    ["  apssdc     = Needs training → APSSDC via EDB"],
    [""],
    ["ROW STATUS (auto):", true, 11],
    ["  Pending     = no editable field filled yet"],
    ["  In Progress = at least one editable field filled"],
    ["  Completed   = all required fields filled and valid"],
    [""],
    ["Red cells = validation problem. Fix before returning."],
    ["Save as .xlsx. Return to admin for import."],
  ];
  instr.forEach((line, i) => {
    const cell = instrSheet.getCell(`A${i + 1}`);
    cell.value = typeof line === "string" ? line : (line[0] as string);
    const bold = Array.isArray(line) && line[1];
    const size = Array.isArray(line) && line[2] ? (line[2] as number) : 10;
    cell.font = {
      bold: !!bold,
      size,
      name: "Calibri",
      color: bold && size >= 14 ? { argb: "FF620124" } : undefined,
    };
  });
  instrSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  // ═══ Masters (hidden, powers dropdowns) ═══
  const mastersSheet = wb.addWorksheet("Masters", { state: "veryHidden" });

  // A: Qualification names for dropdown
  mastersSheet.getCell("A1").value = "Qualification";
  qualRows.forEach((q, i) => { mastersSheet.getCell(`A${i + 2}`).value = q.name; });

  // B: Qualification IDs (parallel lookup)
  mastersSheet.getCell("B1").value = "Qual_ID";
  qualRows.forEach((q, i) => { mastersSheet.getCell(`B${i + 2}`).value = q.id; });

  // C: Districts
  mastersSheet.getCell("C1").value = "District";
  districts.forEach((d, i) => { mastersSheet.getCell(`C${i + 2}`).value = d; });

  // D: Classifications
  const classValues = ["kaushalam", "apssdc", "collector"];
  mastersSheet.getCell("D1").value = "Classification";
  classValues.forEach((c, i) => { mastersSheet.getCell(`D${i + 2}`).value = c; });

  // E: Gender
  const genderValues = ["Any", "Male", "Female"];
  mastersSheet.getCell("E1").value = "Gender";
  genderValues.forEach((g, i) => { mastersSheet.getCell(`E${i + 2}`).value = g; });

  // F: PWD
  const pwdValues = ["yes", "no"];
  mastersSheet.getCell("F1").value = "PWD";
  pwdValues.forEach((p, i) => { mastersSheet.getCell(`F${i + 2}`).value = p; });

  // G: Status
  const statusValues = [
    "validated", "handed_over_scheduling", "handed_over_collector",
    "handed_over_apssdc", "no_requirement", "future", "not_operational", "do_not_call",
  ];
  mastersSheet.getCell("G1").value = "Status";
  statusValues.forEach((s, i) => { mastersSheet.getCell(`G${i + 2}`).value = s; });

  // ═══ Qualification Master (visible reference) ═══
  const qualSheet = wb.addWorksheet("Qualification Master");
  qualSheet.columns = [
    { header: "Qualification Name", key: "name", width: 40 },
    { header: "UUID (for reference only)", key: "id", width: 40 },
  ];
  const qh = qualSheet.getRow(1);
  qh.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };
  qh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF620124" } };
  qualRows.forEach((q) => qualSheet.addRow({ name: q.name, id: q.id }));
  qualSheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  // ═══ Backfill Data (main sheet) ═══
  const ws = wb.addWorksheet("Backfill Data");

  const cols: Partial<ExcelJS.Column>[] = [
    // A–L: read-only
    { header: "company_code", key: "companyCode", width: 18 },
    { header: "company_name", key: "companyName", width: 35 },
    { header: "district", key: "district", width: 18 },
    { header: "sector", key: "sectors", width: 28 },
    { header: "tier", key: "tier", width: 6 },
    { header: "requirement_id", key: "requirementId", width: 38 },
    { header: "reference_id", key: "referenceId", width: 20 },
    { header: "role_name", key: "roleName", width: 30 },
    { header: "required_count", key: "requiredCount", width: 14 },
    { header: "required_within_months", key: "requiredWithinMonths", width: 12 },
    { header: "skills", key: "skills", width: 40 },
    { header: "current_status", key: "currentStatus", width: 14 },
    // M–AA: editable
    { header: "required_count_validated *", key: "requiredCountValidated", width: 18 },  // M
    { header: "qualification_1 *", key: "qualification1", width: 28 },                   // N
    { header: "qualification_2", key: "qualification2", width: 28 },                      // O
    { header: "qualification_3", key: "qualification3", width: 28 },                      // P
    { header: "experience_from *", key: "experienceFrom", width: 14 },                    // Q
    { header: "experience_to *", key: "experienceTo", width: 14 },                        // R
    { header: "gender_preference", key: "genderPreference", width: 16 },                  // S
    { header: "age_limit", key: "ageLimit", width: 12 },                                  // T
    { header: "salary", key: "salary", width: 12 },                                       // U
    { header: "pwd", key: "pwd", width: 8 },                                              // V
    { header: "classification *", key: "classification", width: 16 },                      // W
    { header: "collector_district", key: "collectorDistrict", width: 22 },                 // X
    { header: "handoff_comment *", key: "handoffComment", width: 50 },                     // Y
    { header: "new_status", key: "newStatus", width: 24 },                                 // Z
    { header: "ROW STATUS", key: "rowStatus", width: 14 },                                 // AA
  ];
  ws.columns = cols;

  const greyFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0EDEA" } };
  const greenFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F3EB" } };
  const statusFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
  const headerGrey: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF620124" } };
  const headerGreen: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E7B4E" } };
  const headerStatus: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9601F" } };
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD8D2CE" } },
    bottom: { style: "thin", color: { argb: "FFD8D2CE" } },
    left: { style: "thin", color: { argb: "FFD8D2CE" } },
    right: { style: "thin", color: { argb: "FFD8D2CE" } },
  };

  // Header row
  const hr = ws.getRow(1);
  hr.height = 28;
  hr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
  hr.alignment = { vertical: "middle", wrapText: true };
  for (let c = 1; c <= 27; c++) {
    const cell = hr.getCell(c);
    cell.fill = c <= 12 ? headerGrey : c <= 26 ? headerGreen : headerStatus;
    cell.border = border;
  }

  // Freeze panes
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1, topLeftCell: "A2" }];

  // Helper: split `;`-separated qualification IDs, resolve to names
  const qualIdToName: Record<string, string> = {};
  qualRows.forEach((q) => { qualIdToName[q.id] = q.name; });
  function qualParts(qual: string | null, idx: number): string | null {
    if (!qual) return null;
    const parts = qual.split(";").map((s) => s.trim()).filter(Boolean);
    const id = parts[idx];
    if (!id) return null;
    return qualIdToName[id] || id;
  }

  // Add data rows
  rows.forEach((r) => {
    const row = ws.addRow({
      companyCode: r.companyCode,
      companyName: r.companyName,
      district: r.district ?? "",
      sectors: r.sectors ?? "",
      tier: r.tier,
      requirementId: r.requirementId,
      referenceId: r.referenceId,
      roleName: r.roleName,
      requiredCount: r.requiredCount,
      requiredWithinMonths: r.requiredWithinMonths,
      skills: r.skills ?? "",
      currentStatus: r.currentStatus,
      requiredCountValidated: r.requiredCountValidated != null ? r.requiredCountValidated : "",
      qualification1: qualParts(r.qualification, 0) || "",
      qualification2: qualParts(r.qualification, 1) || "",
      qualification3: qualParts(r.qualification, 2) || "",
      experienceFrom: r.experienceFrom != null ? r.experienceFrom : "",
      experienceTo: r.experienceTo != null ? r.experienceTo : "",
      genderPreference: r.genderPreference || "",
      ageLimit: r.ageLimit || "",
      salary: r.salary || "",
      pwd: r.pwd ? "yes" : "",
      classification: r.classification || "",
      collectorDistrict: r.collectorDistrict || "",
      handoffComment: r.handoffComment || "",
      newStatus: "",
      rowStatus: "",
    });

    row.font = { size: 10, name: "Calibri" };
    row.alignment = { vertical: "top" };

    // Grey locked cols A–L
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      cell.fill = greyFill;
      cell.border = border;
      cell.protection = { locked: true };
    }
    // Green editable cols M–Z
    for (let c = 13; c <= 26; c++) {
      const cell = row.getCell(c);
      cell.fill = greenFill;
      cell.border = border;
      cell.protection = { locked: false };
    }
    // Status col AA — formula, locked
    const statusCell = row.getCell(27);
    statusCell.fill = statusFill;
    statusCell.border = border;
    statusCell.protection = { locked: true };
  });

  const lr = rows.length + 1;

  // ═══ ROW STATUS formula (Column AA) ═══
  // N=qual1, Q=exp_from, R=exp_to, W=classification, Y=handoff_comment
  for (let r = 2; r <= lr; r++) {
    const anyFilled = `OR(M${r}<>"",N${r}<>"",O${r}<>"",P${r}<>"",Q${r}<>"",R${r}<>"",S${r}<>"",T${r}<>"",U${r}<>"",V${r}<>"",W${r}<>"",X${r}<>"",Y${r}<>"",Z${r}<>"")`;
    const allRequired = `AND(M${r}<>"",N${r}<>"",Q${r}<>"",R${r}<>"",W${r}<>"",Y${r}<>"")`;
    const expValid = `OR(AND(Q${r}="",R${r}=""),R${r}>=Q${r})`;
    const collectorOk = `OR(W${r}<>"collector",X${r}<>"")`;

    ws.getCell(`AA${r}`).value = {
      formula: `IF(AND(${allRequired},${expValid},${collectorOk}),"Completed",IF(${anyFilled},"In Progress","Pending"))`,
    } as ExcelJS.CellFormulaValue;

    ws.getCell(`AA${r}`).font = { size: 10, name: "Calibri", bold: true };
  }

  // Conditional formatting for ROW STATUS column
  ws.addConditionalFormatting({
    ref: `AA2:AA${lr}`,
    rules: [
      { type: "cellIs", operator: "equal", formulae: ['"Completed"'], style: { font: { color: { argb: "FF1E7B4E" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F3EB" } } }, priority: 1 },
      { type: "cellIs", operator: "equal", formulae: ['"In Progress"'], style: { font: { color: { argb: "FF9A6A12" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBF1DC" } } }, priority: 2 },
      { type: "cellIs", operator: "equal", formulae: ['"Pending"'], style: { font: { color: { argb: "FFB42318" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 3 },
    ],
  });

  // ═══ Data Validations ═══

  // M: required_count_validated — whole number 0–99999
  ws.dataValidations.add(`M2:M${lr}`, {
    type: "whole", operator: "between", formulae: [0, 99999],
    showErrorMessage: true, errorTitle: "Invalid", error: "Whole number 0–99,999",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
    showInputMessage: true, promptTitle: "Validated Count", prompt: "Confirmed openings (0–99999)",
  });

  // N, O, P: qualification_1/2/3 — dropdown from Masters!A
  const qualFormula = `Masters!$A$2:$A$${qualRows.length + 1}`;
  for (const col of ["N", "O", "P"]) {
    const num = col === "N" ? "1 *" : col === "O" ? "2" : "3";
    ws.dataValidations.add(`${col}2:${col}${lr}`, {
      type: "list", formulae: [qualFormula],
      showErrorMessage: true, errorTitle: "Invalid", error: "Pick from the dropdown list",
      errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
      showInputMessage: true, promptTitle: `Qualification ${num}`, prompt: "Select from dropdown. See Qualification Master tab.",
    });
  }

  // Q: experience_from — whole number 0–15
  ws.dataValidations.add(`Q2:Q${lr}`, {
    type: "whole", operator: "between", formulae: [0, 15],
    showErrorMessage: true, errorTitle: "Invalid", error: "Whole number 0–15",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
    showInputMessage: true, promptTitle: "Experience From", prompt: "Min years (0=fresher, max 15)",
  });

  // R: experience_to — whole number 0–15
  ws.dataValidations.add(`R2:R${lr}`, {
    type: "whole", operator: "between", formulae: [0, 15],
    showErrorMessage: true, errorTitle: "Invalid", error: "Whole number 0–15, must be ≥ experience_from",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
    showInputMessage: true, promptTitle: "Experience To", prompt: "Max years (0–15, must be ≥ From)",
  });

  // S: gender — dropdown
  ws.dataValidations.add(`S2:S${lr}`, {
    type: "list", formulae: [`Masters!$E$2:$E$${genderValues.length + 1}`],
    showErrorMessage: true, errorTitle: "Invalid", error: "Select: Any, Male, or Female",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
  });

  // T: age_limit — whole number 18–65
  ws.dataValidations.add(`T2:T${lr}`, {
    type: "whole", operator: "between", formulae: [18, 65],
    showErrorMessage: true, errorTitle: "Invalid", error: "Whole number 18–65",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
    showInputMessage: true, promptTitle: "Age Limit", prompt: "Max age (18–65)",
  });

  // U: salary — whole number 0–9999999
  ws.dataValidations.add(`U2:U${lr}`, {
    type: "whole", operator: "between", formulae: [0, 9999999],
    showErrorMessage: true, errorTitle: "Invalid", error: "Monthly salary in ₹, number only (0–99,99,999)",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
    showInputMessage: true, promptTitle: "Salary", prompt: "Monthly ₹, number only",
  });

  // V: pwd — dropdown
  ws.dataValidations.add(`V2:V${lr}`, {
    type: "list", formulae: [`Masters!$F$2:$F$${pwdValues.length + 1}`],
    showErrorMessage: true, errorTitle: "Invalid", error: "Select: yes or no",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
  });

  // W: classification — dropdown
  ws.dataValidations.add(`W2:W${lr}`, {
    type: "list", formulae: [`Masters!$D$2:$D$${classValues.length + 1}`],
    showErrorMessage: true, errorTitle: "Invalid", error: "Select: kaushalam, apssdc, or collector",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
  });

  // X: collector_district — dropdown
  ws.dataValidations.add(`X2:X${lr}`, {
    type: "list", formulae: [`Masters!$C$2:$C$${districts.length + 1}`],
    showErrorMessage: true, errorTitle: "Invalid", error: "Select a valid AP district",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
  });

  // Y: handoff_comment — text max 2000
  ws.dataValidations.add(`Y2:Y${lr}`, {
    type: "textLength", operator: "lessThanOrEqual", formulae: [2000],
    showErrorMessage: true, errorTitle: "Too long", error: "Max 2000 characters",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
  });

  // Z: new_status — dropdown
  ws.dataValidations.add(`Z2:Z${lr}`, {
    type: "list", formulae: [`Masters!$G$2:$G$${statusValues.length + 1}`],
    showErrorMessage: true, errorTitle: "Invalid", error: "Select from the dropdown",
    errorStyle: "stop" as ExcelJS.DataValidationErrorStyle,
  });

  // ═══ Conditional Formatting ═══

  // Red when experience_to < experience_from (R < Q)
  ws.addConditionalFormatting({
    ref: `R2:R${lr}`,
    rules: [{ type: "expression", formulae: ['AND(R2<>"",Q2<>"",R2<Q2)'],
      style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 10 }],
  });

  // Red when collector but no district (W=classification, X=district)
  ws.addConditionalFormatting({
    ref: `X2:X${lr}`,
    rules: [{ type: "expression", formulae: ['AND(W2="collector",X2="")'],
      style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 11 }],
  });

  // Red on required fields when status is handed_over_*
  // M=validated_count, N=qual1, Q=exp_from, R=exp_to, W=classification, Y=handoff_comment
  ["M", "N", "Q", "R", "W", "Y"].forEach((col, idx) => {
    ws.addConditionalFormatting({
      ref: `${col}2:${col}${lr}`,
      rules: [{ type: "expression", formulae: [`AND(LEFT(Z2,11)="handed_over",${col}2="")`],
        style: { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAE7" } } }, priority: 20 + idx }],
    });
  });

  // ═══ Sheet protection ═══
  await ws.protect("kaushalam2026", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    sort: true,
    autoFilter: true,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
  });

  ws.autoFilter = { from: "A1", to: "AA1" };

  // ═══ Save ═══
  const today = new Date().toISOString().split("T")[0];
  const suffix = flags.tier ? `-tier${flags.tier}` : flags.status ? `-${flags.status}` : "";
  const outPath = `data/backfill-export-${today}${suffix}.xlsx`;

  await wb.xlsx.writeFile(outPath);

  console.log(`✓ Exported ${rows.length} requirements to ${outPath}`);
  console.log(`  Sheets: Instructions, Backfill Data, Qualification Master, Masters (hidden)`);
  console.log(`  Protection password: kaushalam2026`);
  console.log(`  All validations applied with errorStyle=stop.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
