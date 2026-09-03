import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { company } = await import("../lib/db/schema");
  const { sql, isNotNull, ne, and } = await import("drizzle-orm");

  const [total] = await db.select({ c: sql<number>`count(*)` }).from(company);
  const [withSector] = await db.select({ c: sql<number>`count(*)` }).from(company)
    .where(and(isNotNull(company.sector), ne(company.sector, "")));
  const [withSectors] = await db.select({ c: sql<number>`count(*)` }).from(company)
    .where(and(isNotNull(company.sectors), ne(company.sectors, "")));

  console.log("Total companies:", total.c);
  console.log("With company_sector:", withSector.c);
  console.log("With sectors (plural):", withSectors.c);
  console.log("\n→ sector is from company_sector column in EDB (often empty)");
  console.log("→ sectors (plural) is the ';'-separated field (usually populated)");
  process.exit(0);
}
main();
