import ExcelJS from "exceljs";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("data/backfill-export-2026-09-03.xlsx");

  console.log("=== SHEETS ===");
  wb.eachSheet((ws, id) => {
    console.log(`  ${id}: "${ws.name}" — ${ws.rowCount} rows, ${ws.columnCount} cols, state: ${ws.state}`);
  });

  const ws = wb.getWorksheet("Backfill Data")!;
  console.log("\n=== COLUMNS ===");
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers.push(String(cell.value));
    console.log(`  ${colLetter(col)}: ${cell.value}`);
  });

  console.log("\n=== SAMPLE ROW 2 ===");
  const row2 = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = row2.getCell(i + 1);
    const locked = cell.protection?.locked;
    const val = cell.value;
    const display = val === null || val === undefined || val === "" ? "(empty)" : String(val).substring(0, 50);
    console.log(`  ${colLetter(i + 1)} ${h}: ${display} | locked=${locked}`);
  });

  console.log("\n=== DATA VALIDATIONS ===");
  const dvs = (ws as any).dataValidations;
  if (dvs?.model) {
    for (const [ref, dv] of Object.entries(dvs.model)) {
      const d = dv as any;
      console.log(`  ${ref}: type=${d.type}, formulae=${JSON.stringify(d.formulae)}, errorStyle=${d.errorStyle}`);
    }
  } else {
    console.log("  (none found via model)");
  }

  console.log("\n=== ROW STATUS CHECK (first 10 data rows) ===");
  for (let r = 2; r <= Math.min(11, ws.rowCount); r++) {
    const statusCol = headers.indexOf("ROW STATUS") + 1;
    const cell = ws.getCell(r, statusCol);
    const mVal = ws.getCell(r, 13).value; // required_count_validated
    const nVal = ws.getCell(r, 14).value; // qualification_1
    console.log(`  Row ${r}: status="${cell.value || cell.formula || "(formula)"}", M=${mVal || "(empty)"}, N=${nVal || "(empty)"}`);
  }

  console.log("\n=== PROTECTION ===");
  console.log(`  Sheet protected: ${!!(ws as any).sheetProtection}`);

  const masters = wb.getWorksheet("Masters");
  if (masters) {
    console.log(`\n=== MASTERS SHEET ===`);
    console.log(`  State: ${masters.state}`);
    const qualCount = countNonEmpty(masters, 1);
    const distCount = countNonEmpty(masters, 3);
    const classCount = countNonEmpty(masters, 4);
    const genderCount = countNonEmpty(masters, 5);
    const pwdCount = countNonEmpty(masters, 6);
    const statusCount = countNonEmpty(masters, 7);
    console.log(`  Qualifications: ${qualCount}`);
    console.log(`  Districts: ${distCount}`);
    console.log(`  Classifications: ${classCount}`);
    console.log(`  Genders: ${genderCount}`);
    console.log(`  PWD: ${pwdCount}`);
    console.log(`  Statuses: ${statusCount}`);
  }

  process.exit(0);
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

function countNonEmpty(ws: ExcelJS.Worksheet, col: number): number {
  let count = 0;
  for (let r = 2; r <= 200; r++) {
    if (ws.getCell(r, col).value) count++;
    else break;
  }
  return count;
}

main();
