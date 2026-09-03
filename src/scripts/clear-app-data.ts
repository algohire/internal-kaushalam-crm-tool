import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("Clearing app data (keeping users + qualification_master)...\n");

  // Order matters — foreign keys
  const tables = [
    "audit_log",
    "edb_outbox",
    "requirement_version",
    "task",
    "interaction",
    "requirement",
    "contact",
    "edb_raw",
    "company",
    "import_batch",
  ];

  for (const t of tables) {
    const result = await sql.unsafe(`DELETE FROM "${t}"`);
    console.log(`  ${t}: ${result.count} rows deleted`);
  }

  console.log("\nDone. Users and qualification_master preserved.");
  process.exit(0);
}

main();
