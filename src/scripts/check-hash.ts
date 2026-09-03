import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { account, user } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({ email: user.email, password: account.password, providerId: account.providerId })
    .from(account)
    .innerJoin(user, eq(account.userId, user.id));

  for (const r of rows) {
    const hashPrefix = r.password ? r.password.substring(0, 60) + "..." : "null";
    console.log(`${r.email} | ${r.providerId} | ${hashPrefix}`);
  }
  process.exit(0);
}
main();
