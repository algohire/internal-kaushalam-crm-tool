import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx src/scripts/import-qualification-master.ts <csv-file>");
    console.error("\nCSV format (id is optional — UUID generated if missing):");
    console.error("  name");
    console.error("  10th Standard");
    console.error("  Intermediate / 12th");
    process.exit(1);
  }

  const { db } = await import("../lib/db");
  const { qualificationMaster } = await import("../lib/db/schema");

  const raw = readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const rows: Record<string, string>[] = parse(raw, {
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
    const name = row.name?.trim();
    if (!name) {
      console.error(`  ERROR  Missing name: ${JSON.stringify(row)}`);
      errors++;
      continue;
    }

    const id = crypto.randomUUID();

    try {
      await db
        .insert(qualificationMaster)
        .values({ id, name, createdAt: now })
        .onConflictDoNothing();
      inserted++;
      console.log(`  OK     ${id} — ${name}`);
    } catch {
      skipped++;
      console.log(`  SKIP   ${name} — duplicate`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(0);
}

main();
