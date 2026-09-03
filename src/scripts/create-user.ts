import { auth } from "../lib/auth";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error("Usage: npx tsx src/scripts/create-user.ts <email> <password> <role>");
    console.error("Roles: caller, admin");
    process.exit(1);
  }

  const [email, password, role] = args;

  if (!["caller", "admin"].includes(role)) {
    console.error("Role must be 'caller' or 'admin'");
    process.exit(1);
  }

  const name = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role,
        team: role === "admin" ? "admin" : "rg",
      },
    });

    console.log(`User created: ${email} (${role})`);
    console.log("ID:", result.user?.id);
  } catch (err) {
    console.error("Failed to create user:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
