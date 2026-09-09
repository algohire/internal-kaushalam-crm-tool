"use server";

import { dbPool as db } from "@/lib/db";
import { requireAuth, utcNow, todayDate } from "@/lib/auth-utils";
import {
  interaction,
  requirement,
  requirementVersion,
  company,
  task,
  contact,
  edbOutbox,
  auditLog,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { callSchema } from "@/lib/validations";
import { ZodError } from "zod";

export type RequirementUpdate = {
  id: string;
  roleName: string;
  requiredCount?: number | null;
  roleNameEdited?: string;
  standardRole?: string;
  requiredCountValidated?: number | null;
  qualification?: string;
  experienceFrom?: number | null;
  experienceTo?: number | null;
  genderPreference?: string;
  ageLimit?: string;
  salary?: string;
  pwd?: boolean;
  needTraining: boolean;
  qpCode?: string;
  classification?: string;
  collectorDistrict?: string;
  handoffComment?: string;
  status?: string;
  handoff?: boolean;
};

export type CallInput = {
  companyCode: string;
  contactId: string;
  channel: string;
  disposition: string;
  reasonCode?: string;
  comment: string;
  timing?: string;
  timingDate?: string;
  nextStep: string;
  nextActionDate: string;
  requirements: RequirementUpdate[];
  callOnly?: boolean;
};

const TRACKED_FIELDS = [
  "roleNameEdited",
  "standardRole",
  "requiredCountValidated",
  "qualification",
  "experience",
  "genderPreference",
  "ageLimit",
  "salary",
  "experienceFrom",
  "experienceTo",
  "pwd",
  "needTraining",
  "qpCode",
  "classification",
  "collectorDistrict",
  "handoffComment",
  "comment",
  "status",
  "timing",
  "timingDate",
] as const;

function buildDiff(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of TRACKED_FIELDS) {
    const oldVal = oldRow[field] ?? null;
    const newVal = newRow[field] ?? null;
    if (String(oldVal) !== String(newVal)) {
      diff[field] = { from: oldVal, to: newVal };
    }
  }
  return diff;
}

function handoffStatus(classification: string | undefined): string {
  switch (classification) {
    case "kaushalam":
      return "handed_over_scheduling";
    case "apssdc":
      return "handed_over_apssdc";
    case "collector":
      return "handed_over_collector";
    default:
      return "handed_over_scheduling";
  }
}

function outboxCategory(reqUpdate: RequirementUpdate): string {
  if (reqUpdate.handoff) return "handed_over";
  if (reqUpdate.status === "no_requirement") return "closed";
  return "requirement_changed";
}

export async function logCall(input: CallInput) {
  try {
    callSchema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstMsg = err.issues.map((i) => i.message).join("; ");
      return { error: `Validation failed: ${firstMsg}` };
    }
    return { error: "Invalid input" };
  }

  const validChannels = ["call", "whatsapp", "email", "visit", "inbound"];
  if (!validChannels.includes(input.channel)) {
    return { error: "Invalid channel" };
  }

  const session = await requireAuth();
  const userId = session.user.id;
  const username = session.user.name;
  const now = utcNow();
  const today = todayDate();

  const interactionId = crypto.randomUUID();
  const touchedReqIds: string[] = [];
  const allFieldChanges: Record<string, unknown>[] = [];

  await db.transaction(async (tx) => {
    // 1. Insert interaction
    await tx.insert(interaction).values({
      id: interactionId,
      companyCode: input.companyCode,
      contactId: input.contactId,
      userId,
      username,
      team: "rg",
      channel: input.channel,
      disposition: input.disposition,
      reasonCode: input.reasonCode || null,
      comment: input.comment,
      nextStep: input.nextStep,
      nextActionDate: input.nextActionDate,
      source: "app",
      createdAt: now,
    });

    // 2. Process each requirement (skip for call-only mode)
    if (!input.callOnly)
    for (const reqUpdate of input.requirements) {
      const isNew = !reqUpdate.id;
      const reqId = isNew ? crypto.randomUUID() : reqUpdate.id;
      touchedReqIds.push(reqId);

      const reqStatus = reqUpdate.handoff
        ? handoffStatus(reqUpdate.classification)
        : reqUpdate.status || "captured";

      if (isNew) {
        // New requirement added by caller
        const newReq = {
          id: reqId,
          companyCode: input.companyCode,
          referenceId: `CALLER-${input.companyCode}`,
          roleName: reqUpdate.roleName,
          roleNameEdited: reqUpdate.roleNameEdited || null,
          standardRole: reqUpdate.standardRole || null,
          requiredCountValidated: reqUpdate.requiredCountValidated ?? null,
          qualification: reqUpdate.qualification || null,
          experienceFrom: reqUpdate.experienceFrom ?? null,
          experienceTo: reqUpdate.experienceTo ?? null,
          genderPreference: reqUpdate.genderPreference || null,
          ageLimit: reqUpdate.ageLimit || null,
          salary: reqUpdate.salary || null,
          pwd: reqUpdate.pwd ?? false,
          needTraining: reqUpdate.needTraining,
          qpCode: reqUpdate.qpCode || null,
          classification: reqUpdate.classification || null,
          collectorDistrict: reqUpdate.collectorDistrict || null,
          status: reqStatus,
          handoffComment: reqUpdate.handoffComment || null,
          handedOverAt: reqUpdate.handoff ? now : null,
          handedOverBy: reqUpdate.handoff ? username : null,
          comment: reqUpdate.handoffComment || null,
          timing: input.timing || null,
          timingDate: input.timingDate || null,
          flags: "added_by_caller",
          version: 1,
          createdAt: now,
          updatedAt: now,
          updatedBy: username,
        };

        await tx.insert(requirement).values(newReq);

        await tx.insert(requirementVersion).values({
          id: crypto.randomUUID(),
          requirementId: reqId,
          version: 1,
          changedAt: now,
          changedBy: username,
          interactionId,
          diffJson: JSON.stringify({ _new: true }),
          snapshotJson: JSON.stringify(newReq),
        });

        // Outbox for new requirement
        await tx.insert(edbOutbox).values({
          id: crypto.randomUUID(),
          companyCode: input.companyCode,
          referenceId: newReq.referenceId,
          requirementId: reqId,
          version: 1,
          deltaJson: JSON.stringify({ _new: true, ...newReq }),
          category: outboxCategory(reqUpdate),
          createdAt: now,
        });
      } else {
        // Existing requirement — detect changes
        const [existingReq] = await tx
          .select()
          .from(requirement)
          .where(eq(requirement.id, reqId));

        if (!existingReq) continue;

        const updatedFields: Record<string, unknown> = {
          roleNameEdited: reqUpdate.roleNameEdited || null,
          standardRole: reqUpdate.standardRole || null,
          requiredCountValidated: reqUpdate.requiredCountValidated ?? null,
          qualification: reqUpdate.qualification || null,
          experienceFrom: reqUpdate.experienceFrom ?? null,
          experienceTo: reqUpdate.experienceTo ?? null,
          genderPreference: reqUpdate.genderPreference || null,
          ageLimit: reqUpdate.ageLimit || null,
          salary: reqUpdate.salary || null,
          pwd: reqUpdate.pwd ?? false,
          needTraining: reqUpdate.needTraining,
          qpCode: reqUpdate.qpCode || null,
          classification: reqUpdate.classification || null,
          collectorDistrict: reqUpdate.collectorDistrict || null,
          handoffComment: reqUpdate.handoffComment || null,
          comment: reqUpdate.handoffComment || null,
          status: reqStatus,
          timing: input.timing || null,
          timingDate: input.timingDate || null,
        };

        const diff = buildDiff(existingReq as Record<string, unknown>, updatedFields);
        const hasChanges = Object.keys(diff).length > 0;
        const isHandoff = reqUpdate.handoff && !existingReq.handedOverAt;

        if (hasChanges || isHandoff) {
          const newVersion = existingReq.version + 1;

          await tx
            .update(requirement)
            .set({
              ...updatedFields,
              version: newVersion,
              updatedAt: now,
              updatedBy: username,
              ...(isHandoff
                ? {
                    handedOverAt: now,
                    handedOverBy: username,
                  }
                : {}),
            })
            .where(eq(requirement.id, reqId));

          const snapshot = {
            ...existingReq,
            ...updatedFields,
            version: newVersion,
            updatedAt: now,
            updatedBy: username,
          };

          await tx.insert(requirementVersion).values({
            id: crypto.randomUUID(),
            requirementId: reqId,
            version: newVersion,
            changedAt: now,
            changedBy: username,
            interactionId,
            diffJson: JSON.stringify(diff),
            snapshotJson: JSON.stringify(snapshot),
          });

          // Outbox
          await tx.insert(edbOutbox).values({
            id: crypto.randomUUID(),
            companyCode: input.companyCode,
            referenceId: existingReq.referenceId,
            requirementId: reqId,
            version: newVersion,
            deltaJson: JSON.stringify(diff),
            category: outboxCategory(reqUpdate),
            createdAt: now,
          });

          allFieldChanges.push(diff);
        }
      }
    }

    // 3. Update company denormalized fields
    await tx
      .update(company)
      .set({
        lastDisposition: input.disposition,
        lastContactAt: now,
        contactCount: sql`${company.contactCount} + 1`,
        updatedAt: now,
      })
      .where(eq(company.companyCode, input.companyCode));

    // 4. Close caller's open tasks for this company
    await tx
      .update(task)
      .set({
        status: "done",
        closedByInteraction: interactionId,
        closedAt: now,
      })
      .where(
        and(
          eq(task.companyCode, input.companyCode),
          eq(task.userId, userId),
          eq(task.status, "open")
        )
      );

    // 5. Create new task from next step
    await tx.insert(task).values({
      id: crypto.randomUUID(),
      companyCode: input.companyCode,
      userId,
      title: input.nextStep,
      dueDate: input.nextActionDate,
      source: "next_step",
      status: "open",
      createdByInteraction: interactionId,
      createdAt: now,
    });

    // 6. Handle wrong_contact disposition
    if (input.disposition === "wrong_contact" && input.contactId) {
      await tx
        .update(contact)
        .set({ valid: false })
        .where(eq(contact.id, input.contactId));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await tx.insert(task).values({
        id: crypto.randomUUID(),
        companyCode: input.companyCode,
        userId,
        title: "Find alternate contact",
        dueDate: tomorrowStr,
        source: "retry",
        status: "open",
        createdByInteraction: interactionId,
        createdAt: now,
      });
    }

    // 7. Update interaction with touched requirement IDs
    if (touchedReqIds.length > 0) {
      await tx
        .update(interaction)
        .set({
          requirementIds: touchedReqIds.join(";"),
          fieldsChangedJson:
            allFieldChanges.length > 0
              ? JSON.stringify(Object.assign({}, ...allFieldChanges))
              : null,
        })
        .where(eq(interaction.id, interactionId));
    }

    // 8. Audit log
    await tx.insert(auditLog).values({
      id: crypto.randomUUID(),
      userId,
      username,
      action: "call_logged",
      objectType: "company",
      objectId: input.companyCode,
      detailJson: JSON.stringify({
        interactionId,
        disposition: input.disposition,
        channel: input.channel,
        nextStep: input.nextStep,
        nextActionDate: input.nextActionDate,
        requirementsCount: input.requirements.length,
      }),
      createdAt: now,
    });
  });

  redirect(`/company/${input.companyCode}`);
}
