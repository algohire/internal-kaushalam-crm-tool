import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours
  },
  plugins: [admin()],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "caller",
        input: true,
      },
      team: {
        type: "string",
        required: true,
        defaultValue: "rg",
        input: true,
      },
      active: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: true,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
