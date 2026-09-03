import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { db } = await import("../lib/db");
  const { user } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");

  await db.update(user).set({ role: "admin", team: "admin" }).where(eq(user.email, "admin@kaushalam.in"));
  await db.update(user).set({ role: "caller", team: "rg" }).where(eq(user.email, "caller@kaushalam.in"));

  const users = await db.select({ email: user.email, role: user.role, team: user.team }).from(user);
  console.log("Users:", users);
  process.exit(0);
}

main();
