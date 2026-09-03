import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { user, session, account, verification } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { auth } = await import("../lib/auth");

  // 1. Clear all auth tables
  console.log("Clearing existing users...");
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(user);
  console.log("  Done.\n");

  // 2. Seed new users
  const USERS = [
    { email: "ravi+admin@algohire.ai", password: "admin123", name: "Ravi (Admin)", role: "admin", team: "admin" },
    { email: "ravi+caller@algohire.ai", password: "caller123", name: "Ravi (Caller)", role: "caller", team: "rg" },
  ];

  for (const u of USERS) {
    try {
      const result = await auth.api.signUpEmail({
        body: { email: u.email, password: u.password, name: u.name },
      });

      if (result.user?.id) {
        await db.update(user).set({ role: u.role, team: u.team }).where(eq(user.id, result.user.id));
        console.log(`  OK    ${u.email} (${u.role})`);
      } else {
        console.log(`  FAIL  ${u.email} — no user ID returned`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL  ${u.email}: ${msg}`);
    }
  }

  console.log("\n--- Credentials ---");
  console.log("Admin:  ravi+admin@algohire.ai  / admin123");
  console.log("Caller: ravi+caller@algohire.ai / caller123");
  console.log("-------------------\n");

  process.exit(0);
}

main();
