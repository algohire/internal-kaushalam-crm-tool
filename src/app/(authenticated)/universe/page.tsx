import { Suspense } from "react";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { company, requirement, contact } from "@/lib/db/schema";
import {
  and,
  asc,
  count,
  eq,
  gt,
  ilike,
  isNull,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { UniverseFilters, type FilterOptions } from "@/components/universe/filters";
import { CompanyTable, type CompanyRow } from "@/components/universe/company-table";

const PAGE_SIZE = 25;

function param(params: Record<string, string | string[] | undefined>, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export default async function UniversePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const params = await searchParams;

  const q = param(params, "q");
  const district = param(params, "district");
  const sector = param(params, "sector");
  const subsector = param(params, "subsector");
  const mandal = param(params, "mandal");
  const stage = param(params, "stage");
  const tier = param(params, "tier");
  const classification = param(params, "classification");
  const status = param(params, "status");
  const tags = param(params, "tags");
  const worked = param(params, "worked");
  const page = Math.max(1, parseInt(param(params, "page") || "1", 10) || 1);

  // Build WHERE conditions
  const conditions = [];

  if (q) {
    // Search company name, code, or contact mobile
    const contactMatch = db
      .selectDistinct({ code: contact.companyCode })
      .from(contact)
      .where(ilike(contact.mobile, `%${q.replace(/\D/g, "")}%`));

    conditions.push(
      or(
        ilike(company.companyName, `%${q}%`),
        ilike(company.companyCode, `%${q}%`),
        sql`${company.companyCode} IN (${contactMatch})`
      )
    );
  }

  if (district) conditions.push(eq(company.district, district));
  if (sector) conditions.push(eq(company.sector, sector));
  if (subsector) conditions.push(ilike(company.subsectors, `%${subsector}%`));
  if (mandal) conditions.push(eq(company.mandal, mandal));
  if (stage) conditions.push(eq(company.stage, stage));
  if (tier) conditions.push(eq(company.tier, parseInt(tier, 10)));

  // Tags filter (`;`-separated in DB)
  if (tags) {
    conditions.push(like(company.tags, `%${tags}%`));
  }

  // "Previously worked on" filter
  if (worked === "never") {
    conditions.push(eq(company.contactCount, 0));
  } else if (worked === "60d") {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    conditions.push(
      or(
        lt(company.lastContactAt, sixtyDaysAgo.toISOString()),
        isNull(company.lastContactAt)
      )
    );
  } else if (worked === "month") {
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    conditions.push(gt(company.lastContactAt, firstOfMonth));
  }

  // Classification + status filters (via requirement subquery)
  if (classification || status) {
    const reqConditions = [];
    if (classification === "Not classified") {
      reqConditions.push(isNull(requirement.classification));
    } else if (classification) {
      reqConditions.push(eq(requirement.classification, classification.toLowerCase()));
    }
    if (status) {
      reqConditions.push(eq(requirement.status, status));
    }
    const matchingCodes = db
      .selectDistinct({ code: requirement.companyCode })
      .from(requirement)
      .where(and(...reqConditions));
    conditions.push(sql`${company.companyCode} IN (${matchingCodes})`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Run data queries + filter options in parallel
  const [
    [{ total }],
    rows,
    districtRows,
    sectorRows,
    subsectorRows,
    mandalRows,
    stageRows,
    tagRows,
    tierRows,
    statusRows,
    classificationRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(company).where(whereClause),
    db
      .select()
      .from(company)
      .where(whereClause)
      .orderBy(asc(company.tier), asc(company.companyRank))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.selectDistinct({ v: company.district }).from(company).where(sql`${company.district} IS NOT NULL AND ${company.district} != ''`).orderBy(asc(company.district)),
    db.selectDistinct({ v: company.sector }).from(company).where(sql`${company.sector} IS NOT NULL AND ${company.sector} != ''`).orderBy(asc(company.sector)),
    db.selectDistinct({ v: company.subsectors }).from(company).where(sql`${company.subsectors} IS NOT NULL AND ${company.subsectors} != ''`).orderBy(asc(company.subsectors)),
    db.selectDistinct({ v: company.mandal }).from(company).where(sql`${company.mandal} IS NOT NULL AND ${company.mandal} != ''`).orderBy(asc(company.mandal)),
    db.selectDistinct({ v: company.stage }).from(company).where(sql`${company.stage} IS NOT NULL AND ${company.stage} != ''`).orderBy(asc(company.stage)),
    db.selectDistinct({ v: company.tags }).from(company).where(sql`${company.tags} IS NOT NULL AND ${company.tags} != ''`),
    db.selectDistinct({ v: company.tier }).from(company).where(sql`${company.tier} IS NOT NULL`).orderBy(asc(company.tier)),
    db.selectDistinct({ v: requirement.status }).from(requirement).where(sql`${requirement.status} IS NOT NULL`).orderBy(asc(requirement.status)),
    db.selectDistinct({ v: requirement.classification }).from(requirement).where(sql`${requirement.classification} IS NOT NULL`).orderBy(asc(requirement.classification)),
  ]);

  // Explode `;`-separated subsectors and tags into unique values
  const allSubsectors = new Set<string>();
  subsectorRows.forEach((r) => {
    if (r.v) r.v.split(";").map((s) => s.trim()).filter(Boolean).forEach((s) => allSubsectors.add(s));
  });

  const allTags = new Set<string>();
  tagRows.forEach((r) => {
    if (r.v) r.v.split(";").map((s) => s.trim()).filter(Boolean).forEach((s) => allTags.add(s));
  });

  // Get requirement counts per company for the page
  const companyCodes = rows.map((r) => r.companyCode);
  let reqCounts: Record<string, number> = {};
  if (companyCodes.length > 0) {
    const reqCountRows = await db
      .select({ companyCode: requirement.companyCode, cnt: count() })
      .from(requirement)
      .where(sql`${requirement.companyCode} IN (${sql.join(companyCodes.map((c) => sql`${c}`), sql`, `)})`)
      .groupBy(requirement.companyCode);
    reqCounts = Object.fromEntries(reqCountRows.map((r) => [r.companyCode, r.cnt]));
  }

  const companies: CompanyRow[] = rows.map((r) => ({
    companyCode: r.companyCode,
    companyName: r.companyName,
    sector: r.sector,
    subsectors: r.subsectors,
    district: r.district,
    mandal: r.mandal,
    presentHeadcount: r.presentHeadcount,
    totalRequired: r.totalRequired,
    tier: r.tier,
    flags: r.flags,
    tags: r.tags,
    lastDisposition: r.lastDisposition,
    lastContactAt: r.lastContactAt,
    contactCount: r.contactCount,
    requirementCount: reqCounts[r.companyCode] ?? 0,
  }));

  const filterOptions: FilterOptions = {
    districts: districtRows.map((r) => r.v).filter(Boolean) as string[],
    sectors: sectorRows.map((r) => r.v).filter(Boolean) as string[],
    subsectors: Array.from(allSubsectors).sort(),
    mandals: mandalRows.map((r) => r.v).filter(Boolean) as string[],
    stages: stageRows.map((r) => r.v).filter(Boolean) as string[],
    tags: Array.from(allTags).sort(),
    tiers: tierRows.map((r) => r.v).filter((v): v is number => v !== null),
    statuses: statusRows.map((r) => r.v).filter(Boolean) as string[],
    classifications: classificationRows.map((r) => r.v).filter(Boolean) as string[],
  };

  return (
    <div>
      <div className="flex items-end gap-4 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Universe</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} companies from EDB
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <UniverseFilters options={filterOptions} />
      </Suspense>

      <CompanyTable
        companies={companies}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
