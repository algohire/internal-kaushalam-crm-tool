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
  const { eq, and } = await import("drizzle-orm");
  const { hashPassword } = await import("@better-auth/utils/password");

  // Find user
  const [u] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.email, email));
  if (!u) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  // Hash with Better Auth's own scrypt (salt:hex format)
  const hash = await hashPassword(newPassword);

  // Update existing credential account
  const result = await db
    .update(account)
    .set({ password: hash, updatedAt: new Date() })
    .where(and(eq(account.userId, u.id), eq(account.providerId, "credential")));

  console.log(`Password reset for ${email} (${u.name})`);
  console.log(`New password: ${newPassword}`);
  console.log(`Hash: ${hash.substring(0, 20)}... (scrypt)`);
  process.exit(0);
}

main();
