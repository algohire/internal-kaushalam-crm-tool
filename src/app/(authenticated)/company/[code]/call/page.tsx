import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  company as companyTable,
  contact as contactTable,
  requirement as requirementTable,
} from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-utils";
import { CallFormClient } from "./call-form-client";

export default async function LogCallPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireAuth();
  const { code } = await params;

  const [companyRow] = await db
    .select({
      companyCode: companyTable.companyCode,
      companyName: companyTable.companyName,
    })
    .from(companyTable)
    .where(eq(companyTable.companyCode, code));

  if (!companyRow) notFound();

  const contacts = await db
    .select({
      id: contactTable.id,
      name: contactTable.name,
      designation: contactTable.designation,
      mobile: contactTable.mobile,
      valid: contactTable.valid,
    })
    .from(contactTable)
    .where(eq(contactTable.companyCode, code));

  const requirements = await db
    .select({
      id: requirementTable.id,
      roleName: requirementTable.roleName,
      roleNameEdited: requirementTable.roleNameEdited,
      standardRole: requirementTable.standardRole,
      requiredCount: requirementTable.requiredCount,
      requiredCountValidated: requirementTable.requiredCountValidated,
      qualification: requirementTable.qualification,
      experience: requirementTable.experience,
      genderPreference: requirementTable.genderPreference,
      ageLimit: requirementTable.ageLimit,
      salary: requirementTable.salary,
      shift: requirementTable.shift,
      monthlyIntake: requirementTable.monthlyIntake,
      needTraining: requirementTable.needTraining,
      qpCode: requirementTable.qpCode,
      classification: requirementTable.classification,
      collectorDistrict: requirementTable.collectorDistrict,
      handoffComment: requirementTable.handoffComment,
      comment: requirementTable.comment,
      status: requirementTable.status,
    })
    .from(requirementTable)
    .where(
      and(
        eq(requirementTable.companyCode, code),
        ne(requirementTable.status, "handed_over_scheduling"),
        ne(requirementTable.status, "handed_over_collector"),
        ne(requirementTable.status, "handed_over_apssdc")
      )
    );

  return (
    <CallFormClient
      company={companyRow}
      contacts={contacts}
      requirements={requirements}
    />
  );
}
