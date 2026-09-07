"use server";

import { db } from "@/lib/db";
import { requirement, company, contact, qualificationMaster } from "@/lib/db/schema";
import { eq, like, and, gte, lte, sql, asc, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-utils";

export async function exportHandedOverCSV(filters: {
  route?: string;
  from?: string;
  to?: string;
}) {
  await requireAuth();

  const conditions = [like(requirement.status, "handed_over_%")];

  if (filters.route === "scheduling") {
    conditions.push(eq(requirement.status, "handed_over_scheduling"));
  } else if (filters.route === "collector") {
    conditions.push(eq(requirement.status, "handed_over_collector"));
  } else if (filters.route === "apssdc") {
    conditions.push(eq(requirement.status, "handed_over_apssdc"));
  }

  if (filters.from) {
    conditions.push(gte(requirement.handedOverAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lte(requirement.handedOverAt, filters.to + "T23:59:59Z"));
  }

  const [rows, qualRows] = await Promise.all([
    db
      .select({
        companyCode: company.companyCode,
        companyName: company.companyName,
        district: company.district,
        sector: company.sectors,
        roleName: requirement.roleName,
        roleNameEdited: requirement.roleNameEdited,
        requiredCountValidated: requirement.requiredCountValidated,
        qualification: requirement.qualification,
        experienceFrom: requirement.experienceFrom,
        experienceTo: requirement.experienceTo,
        genderPreference: requirement.genderPreference,
        salary: requirement.salary,
        classification: requirement.classification,
        collectorDistrict: requirement.collectorDistrict,
        handoffComment: requirement.handoffComment,
        handedOverBy: requirement.handedOverBy,
        handedOverAt: requirement.handedOverAt,
        status: requirement.status,
        contactName: contact.name,
        contactMobile: contact.mobile,
        contactEmail: contact.email,
        contactDesignation: contact.designation,
      })
      .from(requirement)
      .innerJoin(company, eq(requirement.companyCode, company.companyCode))
      .leftJoin(
        contact,
        and(
          eq(contact.companyCode, requirement.companyCode),
          eq(contact.isPrimary, true)
        )
      )
      .where(and(...conditions))
      .orderBy(asc(company.companyName), asc(requirement.roleName)),
    db
      .select({ id: qualificationMaster.id, name: qualificationMaster.name })
      .from(qualificationMaster),
  ]);

  // Build qualification lookup
  const qualMap: Record<string, string> = {};
  for (const q of qualRows) qualMap[q.id] = q.name;

  function resolveQuals(raw: string | null): string {
    if (!raw) return "";
    return raw
      .split(";")
      .map((id) => qualMap[id.trim()] || id.trim())
      .filter(Boolean)
      .join("; ");
  }

  function routeLabel(status: string): string {
    if (status === "handed_over_scheduling") return "Scheduling";
    if (status === "handed_over_collector") return "Collector";
    if (status === "handed_over_apssdc") return "APSSDC";
    return status;
  }

  function escapeCsv(val: unknown): string {
    if (val === null || val === undefined) return "";
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headers = [
    "Company Code",
    "Company Name",
    "District",
    "Sector",
    "Role",
    "Validated Count",
    "Qualification",
    "Experience",
    "Gender Preference",
    "Salary (₹/month)",
    "Route",
    "Collector District",
    "Handoff Comment",
    "Handed Over By",
    "Handed Over Date",
    "Contact Name",
    "Contact Mobile",
    "Contact Email",
    "Contact Designation",
  ];

  const csvRows = [headers.join(",")];

  for (const r of rows) {
    const experience =
      r.experienceFrom != null && r.experienceTo != null
        ? `${r.experienceFrom}–${r.experienceTo} yrs`
        : "";

    const handedDate = r.handedOverAt
      ? new Date(r.handedOverAt).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";

    csvRows.push(
      [
        r.companyCode,
        r.companyName,
        r.district,
        r.sector,
        r.roleNameEdited || r.roleName,
        r.requiredCountValidated,
        resolveQuals(r.qualification),
        experience,
        r.genderPreference,
        r.salary,
        routeLabel(r.status),
        r.collectorDistrict,
        r.handoffComment,
        r.handedOverBy,
        handedDate,
        r.contactName,
        r.contactMobile,
        r.contactEmail,
        r.contactDesignation,
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  return {
    csv: csvRows.join("\n"),
    count: rows.length,
    route: filters.route || "all",
  };
}
