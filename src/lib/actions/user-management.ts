"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-utils";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createUserSchema, resetPasswordSchema } from "@/lib/validations";
import { ZodError } from "zod";

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  try {
    createUserSchema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message || "Invalid input" };
    }
    return { error: "Invalid input" };
  }

  await requireAdmin();

  const result = await auth.api.signUpEmail({
    body: {
      name: data.name,
      email: data.email,
      password: data.password,
    },
    headers: await headers(),
  });

  if (!result?.user?.id) {
    return { error: "Failed to create user" };
  }

  await db
    .update(user)
    .set({
      role: data.role as "caller" | "admin",
      team: data.role === "admin" ? "admin" : "rg",
    })
    .where(eq(user.id, result.user.id));

  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserActive(userId: string) {
  await requireAdmin();

  const [existing] = await db
    .select({ active: user.active })
    .from(user)
    .where(eq(user.id, userId));

  if (!existing) {
    return { error: "User not found" };
  }

  await db
    .update(user)
    .set({ active: !existing.active, updatedAt: new Date() })
    .where(eq(user.id, userId));

  revalidatePath("/admin/users");
  return { success: true };
}

export async function resetPassword(userId: string, newPassword: string) {
  try {
    resetPasswordSchema.parse({ userId, newPassword });
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message || "Invalid input" };
    }
    return { error: "Invalid input" };
  }

  await requireAdmin();

  const { hashPassword } = await import("@better-auth/utils/password");

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(account)
    .set({ password: passwordHash, updatedAt: new Date() })
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));

  revalidatePath("/admin/users");
  return { success: true };
}

export async function changeRole(userId: string, role: string) {
  await requireAdmin();

  await db
    .update(user)
    .set({
      role: role as "caller" | "admin",
      team: role === "admin" ? "admin" : "rg",
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  revalidatePath("/admin/users");
  return { success: true };
}
