"use server";

import { db } from "@/lib/db";
import { contact, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, utcNow } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { addContactSchema } from "@/lib/validations";
import { ZodError } from "zod";

export async function addContact(data: {
  companyCode: string;
  name: string;
  designation: string;
  mobile: string;
  email: string;
  pocFor: string;
}) {
  try {
    addContactSchema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message || "Invalid input" };
    }
    return { error: "Invalid input" };
  }

  const session = await requireAuth();
  const id = crypto.randomUUID();
  const now = utcNow();

  const normalizedMobile = data.mobile.replace(/\D/g, "").slice(-10);

  await db.insert(contact).values({
    id,
    companyCode: data.companyCode,
    name: data.name,
    designation: data.designation,
    mobileRaw: data.mobile,
    mobile: normalizedMobile.length === 10 ? normalizedMobile : null,
    email: data.email || null,
    pocFor: data.pocFor || "requirement",
    source: "caller",
    isPrimary: false,
    valid: true,
    createdAt: now,
    createdBy: session.user.name,
  });

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    username: session.user.name,
    action: "contact_added",
    objectType: "contact",
    objectId: id,
    detailJson: JSON.stringify({
      companyCode: data.companyCode,
      name: data.name,
    }),
    createdAt: now,
  });

  revalidatePath(`/company/${data.companyCode}`);
  return { id };
}

export async function markContactInvalid(contactId: string, companyCode: string) {
  const session = await requireAuth();
  const now = utcNow();

  await db
    .update(contact)
    .set({ valid: false })
    .where(eq(contact.id, contactId));

  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    username: session.user.name,
    action: "contact_invalidated",
    objectType: "contact",
    objectId: contactId,
    detailJson: JSON.stringify({ companyCode }),
    createdAt: now,
  });

  revalidatePath(`/company/${companyCode}`);
}
