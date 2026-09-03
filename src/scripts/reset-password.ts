import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error("Usage: npx tsx src/scripts/reset-password.ts <email> <new-password>");
    process.exit(1);
  }

  const { db } = await import("../lib/db");
  const { user, account } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { auth } = await import("../lib/auth");

  // Find user
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!u) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  // Delete old credential account
  await db.delete(account).where(eq(account.userId, u.id));

  // Re-create via Better Auth signUpEmail — but user already exists
  // So we use the internal createAccount path
  const result = await auth.api.signInEmail({
    body: { email, password: newPassword },
  }).catch(() => null);

  if (result) {
    console.log("User already had correct password.");
    process.exit(0);
  }

  // Create fresh credential via Better Auth's own hashing
  // by signing up a temp user then moving the account
  const tempEmail = `reset-${Date.now()}@temp.local`;
  const signupResult = await auth.api.signUpEmail({
    body: { email: tempEmail, password: newPassword, name: "temp" },
  });

  if (!signupResult?.user?.id) {
    console.error("Failed to create temp account for password hash");
    process.exit(1);
  }

  // Get the password hash from the temp account
  const [tempAccount] = await db
    .select({ password: account.password })
    .from(account)
    .where(eq(account.userId, signupResult.user.id));

  if (!tempAccount?.password) {
    console.error("Failed to get password hash");
    process.exit(1);
  }

  // Create credential account for the real user with the correct hash
  const { randomUUID } = await import("node:crypto");
  await db.insert(account).values({
    id: randomUUID(),
    accountId: u.id,
    providerId: "credential",
    userId: u.id,
    password: tempAccount.password,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Clean up temp user
  const { session } = await import("../lib/db/schema");
  await db.delete(session).where(eq(session.userId, signupResult.user.id));
  await db.delete(account).where(eq(account.userId, signupResult.user.id));
  await db.delete(user).where(eq(user.id, signupResult.user.id));

  console.log(`Password reset for ${email}`);
  console.log(`New password: ${newPassword}`);
  process.exit(0);
}

main();
