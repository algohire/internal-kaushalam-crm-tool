import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { qualificationMaster } = await import("../lib/db/schema");
  const now = new Date().toISOString();

  const demo = [
    "10th Standard",
    "Intermediate / 12th",
    "ITI Certificate",
    "Diploma in Engineering",
    "B.Tech / BE",
  ];

  for (const name of demo) {
    const id = crypto.randomUUID();
    try {
      await db.insert(qualificationMaster).values({ id, name, createdAt: now }).onConflictDoNothing();
      console.log(`  OK  ${id} — ${name}`);
    } catch {
      console.log(`  SKIP ${name} — already exists`);
    }
  }

  console.log("\nDone. 5 demo qualifications seeded.");
  process.exit(0);
}

main();
