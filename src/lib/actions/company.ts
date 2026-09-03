"use server";

import { db } from "@/lib/db";
import { company, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, utcNow } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { updateTagsSchema } from "@/lib/validations";
import { ZodError } from "zod";

export async function updateCompanyTags(companyCode: string, newTags: string[]) {
  try {
    updateTagsSchema.parse({ companyCode, tags: newTags });
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message || "Invalid input" };
    }
    return { error: "Invalid input" };
  }

  const session = await requireAuth();
  const now = utcNow();

  const tagsStr = newTags.length > 0 ? newTags.join(";") : null;

  await db
    .update(company)
    .set({ tags: tagsStr, updatedAt: now })
    .where(eq(company.companyCode, companyCode));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    username: session.user.name,
    action: "tags_updated",
    objectType: "company",
    objectId: companyCode,
    detailJson: JSON.stringify({ tags: newTags }),
    createdAt: now,
  });

  revalidatePath(`/company/${companyCode}`);
}

export async function toggleBookmark(companyCode: string) {
  const session = await requireAuth();
  const now = utcNow();
  const userId = session.user.id;

  const [co] = await db
    .select({ bookmarkedBy: company.bookmarkedBy })
    .from(company)
    .where(eq(company.companyCode, companyCode));

  if (!co) return { error: "Company not found" };

  const currentIds = co.bookmarkedBy ? co.bookmarkedBy.split(";").filter(Boolean) : [];
  const isBookmarked = currentIds.includes(userId);

  const newIds = isBookmarked
    ? currentIds.filter((id) => id !== userId)
    : [...currentIds, userId];

  await db
    .update(company)
    .set({
      bookmarkedBy: newIds.length > 0 ? newIds.join(";") : null,
      updatedAt: now,
    })
    .where(eq(company.companyCode, companyCode));

  revalidatePath("/universe");
  revalidatePath(`/company/${companyCode}`);
  return { bookmarked: !isBookmarked };
}
