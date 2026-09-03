import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

async function main() {
  const { auth } = await import("../lib/auth");
  const { db } = await import("../lib/db");
  const { user } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const SEED_USERS = [
    {
      email: "admin@kaushalam.in",
      password: "admin123",
      name: "Ravi Kumar",
      role: "admin" as const,
      team: "admin" as const,
    },
    {
      email: "caller@kaushalam.in",
      password: "caller123",
      name: "Lakshmi Prasanna",
      role: "caller" as const,
      team: "rg" as const,
    },
  ];

  console.log("Seeding users...\n");

  for (const u of SEED_USERS) {
    try {
      const existing = await db
        .select()
        .from(user)
        .where(eq(user.email, u.email));

      if (existing.length > 0) {
        console.log(`  SKIP  ${u.email} (already exists)`);
        continue;
      }

      const result = await auth.api.signUpEmail({
        body: {
          email: u.email,
          password: u.password,
          name: u.name,
        },
      });

      if (result.user?.id) {
        await db
          .update(user)
          .set({ role: u.role, team: u.team })
          .where(eq(user.id, result.user.id));

        console.log(`  OK    ${u.email} (${u.role})`);
      }
    } catch (err) {
      console.error(`  FAIL  ${u.email}:`, err);
    }
  }

  console.log("\n--- Credentials ---");
  console.log("Admin:  admin@kaushalam.in  /  admin123");
  console.log("Caller: caller@kaushalam.in /  caller123");
  console.log("-------------------\n");

  process.exit(0);
}

main();
