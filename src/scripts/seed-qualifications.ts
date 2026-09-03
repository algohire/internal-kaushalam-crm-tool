import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { qualificationMaster } = await import("../lib/db/schema");
  const now = new Date().toISOString();

  const demo = [
    { id: "QUAL-001", name: "10th Standard" },
    { id: "QUAL-002", name: "Intermediate / 12th" },
    { id: "QUAL-003", name: "ITI Certificate" },
    { id: "QUAL-004", name: "Diploma in Engineering" },
    { id: "QUAL-005", name: "B.Tech / BE" },
  ];

  for (const q of demo) {
    try {
      await db.insert(qualificationMaster).values({ ...q, createdAt: now }).onConflictDoNothing();
      console.log(`  OK  ${q.id} — ${q.name}`);
    } catch (err) {
      console.log(`  SKIP ${q.id} — already exists`);
    }
  }

  console.log("\nDone. 5 demo qualifications seeded.");
  process.exit(0);
}

main();
