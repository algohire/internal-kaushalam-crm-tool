import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  company as companyTable,
  contact as contactTable,
  requirement as requirementTable,
  qualificationMaster,
} from "@/lib/db/schema";
import { eq, and, ne, asc } from "drizzle-orm";
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
      requiredCount: requirementTable.requiredCount,
      requiredCountValidated: requirementTable.requiredCountValidated,
      qualification: requirementTable.qualification,
      experienceFrom: requirementTable.experienceFrom,
      experienceTo: requirementTable.experienceTo,
      genderPreference: requirementTable.genderPreference,
      ageLimit: requirementTable.ageLimit,
      salary: requirementTable.salary,
      pwd: requirementTable.pwd,
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

  const qualifications = await db
    .select({ id: qualificationMaster.id, name: qualificationMaster.name })
    .from(qualificationMaster)
    .orderBy(asc(qualificationMaster.name));

  return (
    <CallFormClient
      company={companyRow}
      contacts={contacts}
      requirements={requirements}
      qualificationOptions={qualifications}
    />
  );
}
