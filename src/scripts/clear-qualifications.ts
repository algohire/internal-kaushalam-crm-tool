import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { qualificationMaster } = await import("../lib/db/schema");
  await db.delete(qualificationMaster);
  console.log("Cleared all qualifications.");
  process.exit(0);
}
main();
