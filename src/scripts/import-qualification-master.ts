import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx src/scripts/import-qualification-master.ts <csv-file>");
    console.error("\nCSV format:");
    console.error("  id,name");
    console.error("  QUAL-001,10th Standard");
    console.error("  QUAL-002,Intermediate / 12th");
    process.exit(1);
  }

  const { db } = await import("../lib/db");
  const { qualificationMaster } = await import("../lib/db/schema");

  const raw = readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const rows: { id: string; name: string }[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`\nParsed ${rows.length} rows from ${filePath}\n`);

  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    if (!row.id || !row.name) {
      console.error(`  ERROR  Missing id or name: ${JSON.stringify(row)}`);
      errors++;
      continue;
    }

    try {
      await db
        .insert(qualificationMaster)
        .values({ id: row.id.trim(), name: row.name.trim(), createdAt: now })
        .onConflictDoNothing();
      inserted++;
      console.log(`  OK     ${row.id} — ${row.name}`);
    } catch {
      skipped++;
      console.log(`  SKIP   ${row.id} — duplicate`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(0);
}

main();
