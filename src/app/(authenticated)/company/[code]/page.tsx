import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  company,
  contact,
  requirement,
  requirementVersion,
  interaction,
  task,
  qualificationMaster,
} from "@/lib/db/schema";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { CompanyPageClient } from "./company-page-client";

const TIMELINE_PAGE_SIZE = 20;

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const tlPage = Math.max(1, parseInt(typeof sp.tlPage === "string" ? sp.tlPage : "1", 10) || 1);

  const [
    comp,
    contacts,
    requirements,
    [{ timelineTotal }],
    interactions,
    openTasks,
    qualRows,
  ] = await Promise.all([
    db.query.company.findFirst({ where: eq(company.companyCode, code) }),
    db
      .select()
      .from(contact)
      .where(eq(contact.companyCode, code))
      .orderBy(desc(contact.isPrimary), asc(contact.createdAt)),
    db
      .select()
      .from(requirement)
      .where(eq(requirement.companyCode, code))
      .orderBy(asc(requirement.createdAt)),
    db
      .select({ timelineTotal: count() })
      .from(interaction)
      .where(eq(interaction.companyCode, code)),
    db
      .select()
      .from(interaction)
      .where(eq(interaction.companyCode, code))
      .orderBy(desc(interaction.createdAt))
      .limit(TIMELINE_PAGE_SIZE)
      .offset((tlPage - 1) * TIMELINE_PAGE_SIZE),
    db
      .select()
      .from(task)
      .where(and(eq(task.companyCode, code), eq(task.status, "open")))
      .orderBy(asc(task.dueDate)),
    db.select({ id: qualificationMaster.id, name: qualificationMaster.name }).from(qualificationMaster),
  ]);

  if (!comp) notFound();

  const reqIds = requirements.map((r) => r.id);
  let versions: (typeof requirementVersion.$inferSelect)[] = [];
  if (reqIds.length > 0) {
    const allVersions = await Promise.all(
      reqIds.map((rid) =>
        db
          .select()
          .from(requirementVersion)
          .where(eq(requirementVersion.requirementId, rid))
          .orderBy(desc(requirementVersion.version))
      )
    );
    versions = allVersions.flat();
  }

  const requirementNames: Record<string, string> = {};
  for (const r of requirements) {
    requirementNames[r.id] = r.roleNameEdited || r.roleName;
  }

  const latestOpenTask = openTasks[0] ?? null;
  const currentTags = comp.tags?.split(";").filter(Boolean) ?? [];

  const qualMap: Record<string, string> = {};
  for (const q of qualRows) qualMap[q.id] = q.name;

  return (
    <CompanyPageClient
      company={comp}
      contacts={contacts}
      requirements={requirements}
      versions={versions}
      interactions={interactions}
      openTasks={openTasks}
      latestOpenTask={latestOpenTask}
      requirementNames={requirementNames}
      currentTags={currentTags}
      timelineTotal={timelineTotal}
      timelinePage={tlPage}
      timelinePageSize={TIMELINE_PAGE_SIZE}
      qualificationMap={qualMap}
    />
  );
}
