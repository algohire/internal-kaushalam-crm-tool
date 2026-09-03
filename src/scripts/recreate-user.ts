import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const role = process.argv[4] || "admin";

  if (!email || !password) {
    console.error("Usage: npx tsx src/scripts/recreate-user.ts <email> <password> [role]");
    process.exit(1);
  }

  const { db } = await import("../lib/db");
  const { user, account, session } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { auth } = await import("../lib/auth");

  // Get existing user info before deleting
  const [existing] = await db.select().from(user).where(eq(user.email, email));
  const name = existing?.name || email.split("@")[0];

  // Delete existing records
  if (existing) {
    await db.delete(session).where(eq(session.userId, existing.id));
    await db.delete(account).where(eq(account.userId, existing.id));
    await db.delete(user).where(eq(user.id, existing.id));
    console.log(`Deleted existing user: ${email}`);
  }

  // Create fresh via Better Auth
  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });

  if (!result?.user?.id) {
    console.error("Failed to create user");
    process.exit(1);
  }

  // Set role
  await db.update(user).set({ role, team: role === "admin" ? "admin" : "rg" }).where(eq(user.id, result.user.id));

  // Verify the hash format
  const [acc] = await db.select({ password: account.password }).from(account).where(eq(account.userId, result.user.id));
  console.log(`Hash format: ${acc?.password?.substring(0, 20)}...`);

  console.log(`\nUser recreated: ${email} (${role})`);
  console.log(`Password: ${password}`);
  process.exit(0);
}

main();
