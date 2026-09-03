import { db } from "@/lib/db";
import { company, interaction, requirement, task, user } from "@/lib/db/schema";
import { eq, and, gte, like, isNotNull, sql, count, sum } from "drizzle-orm";
import { requireAdmin, todayDate } from "@/lib/auth-utils";
import { KpiCards } from "@/components/admin/kpi-cards";
import { CallerTable, type CallerRow } from "@/components/admin/caller-table";
import { PeriodSelector } from "@/components/admin/period-selector";

const CONNECTED_DISPOSITIONS = [
  "hiring_now",
  "hiring_later",
  "no_requirement",
  "not_operational",
  "do_not_call",
];

function periodStartDate(period: string): string | null {
  const now = new Date();
  switch (period) {
    case "today":
      return now.toISOString().split("T")[0];
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return monday.toISOString().split("T")[0];
    }
    case "month":
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    case "all":
      return null;
    default:
      return null;
  }
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const period = params.period || "week";
  const startDate = periodStartDate(period);

  const [
    totalCompaniesResult,
    attemptedResult,
    connectedResult,
    reqsValidatedResult,
    openingsResult,
    handedOverResult,
    handedOverSResult,
    handedOverCResult,
    handedOverAResult,
    callerStats,
  ] = await Promise.all([
    // Total companies (no period filter)
    db.select({ value: count() }).from(company),

    // Attempted
    db
      .select({ value: sql<number>`COUNT(DISTINCT ${interaction.companyCode})` })
      .from(interaction)
      .where(startDate ? gte(interaction.createdAt, startDate) : undefined),

    // Connected
    db
      .select({ value: sql<number>`COUNT(DISTINCT ${interaction.companyCode})` })
      .from(interaction)
      .where(
        and(
          sql`${interaction.disposition} IN (${sql.join(
            CONNECTED_DISPOSITIONS.map((d) => sql`${d}`),
            sql`, `
          )})`,
          startDate ? gte(interaction.createdAt, startDate) : undefined
        )
      ),

    // Requirements validated
    db
      .select({ value: count() })
      .from(requirement)
      .where(
        and(
          isNotNull(requirement.requiredCountValidated),
          startDate ? gte(requirement.updatedAt, startDate) : undefined
        )
      ),

    // Openings validated
    db
      .select({ value: sum(requirement.requiredCountValidated) })
      .from(requirement)
      .where(
        and(
          isNotNull(requirement.requiredCountValidated),
          startDate ? gte(requirement.updatedAt, startDate) : undefined
        )
      ),

    // Handed over total
    db
      .select({ value: count() })
      .from(requirement)
      .where(
        and(
          like(requirement.status, "handed_over_%"),
          startDate ? gte(requirement.handedOverAt, startDate) : undefined
        )
      ),

    // Handed over scheduling
    db
      .select({ value: count() })
      .from(requirement)
      .where(
        and(
          eq(requirement.status, "handed_over_scheduling"),
          startDate ? gte(requirement.handedOverAt, startDate) : undefined
        )
      ),

    // Handed over collector
    db
      .select({ value: count() })
      .from(requirement)
      .where(
        and(
          eq(requirement.status, "handed_over_collector"),
          startDate ? gte(requirement.handedOverAt, startDate) : undefined
        )
      ),

    // Handed over apssdc
    db
      .select({ value: count() })
      .from(requirement)
      .where(
        and(
          eq(requirement.status, "handed_over_apssdc"),
          startDate ? gte(requirement.handedOverAt, startDate) : undefined
        )
      ),

    // Per-caller stats
    db
      .select({
        userId: user.id,
        userName: user.name,
        dials: sql<number>`COUNT(${interaction.id})`,
        connects: sql<number>`COUNT(CASE WHEN ${interaction.disposition} IN ('hiring_now','hiring_later','no_requirement','not_operational','do_not_call') THEN 1 END)`,
      })
      .from(user)
      .leftJoin(
        interaction,
        and(
          eq(user.id, interaction.userId),
          startDate ? gte(interaction.createdAt, startDate) : undefined
        )
      )
      .where(eq(user.active, true))
      .groupBy(user.id, user.name),
  ]);

  const today = todayDate();

  // Fetch per-caller requirement stats and overdue tasks separately
  const callerRows: CallerRow[] = await Promise.all(
    callerStats.map(async (cs) => {
      const [reqStats] = await db
        .select({
          validated: sql<number>`COUNT(CASE WHEN ${requirement.requiredCountValidated} IS NOT NULL THEN 1 END)`,
          openings: sql<number>`COALESCE(SUM(${requirement.requiredCountValidated}), 0)`,
          handoffsS: sql<number>`COUNT(CASE WHEN ${requirement.status} = 'handed_over_scheduling' THEN 1 END)`,
          handoffsC: sql<number>`COUNT(CASE WHEN ${requirement.status} = 'handed_over_collector' THEN 1 END)`,
          handoffsA: sql<number>`COUNT(CASE WHEN ${requirement.status} = 'handed_over_apssdc' THEN 1 END)`,
        })
        .from(requirement)
        .where(
          and(
            eq(requirement.updatedBy, cs.userId),
            startDate ? gte(requirement.updatedAt, startDate) : undefined
          )
        );

      const [overdueResult] = await db
        .select({ value: count() })
        .from(task)
        .where(
          and(
            eq(task.userId, cs.userId),
            eq(task.status, "open"),
            sql`${task.dueDate} < ${today}`
          )
        );

      const dials = Number(cs.dials) || 0;
      const connects = Number(cs.connects) || 0;

      return {
        name: cs.userName,
        dials,
        connects,
        connectPct: dials > 0 ? `${Math.round((connects / dials) * 100)}%` : "—",
        reqsValidated: Number(reqStats?.validated) || 0,
        openingsValidated: Number(reqStats?.openings) || 0,
        handoffsS: Number(reqStats?.handoffsS) || 0,
        handoffsC: Number(reqStats?.handoffsC) || 0,
        handoffsA: Number(reqStats?.handoffsA) || 0,
        overdueTasks: Number(overdueResult?.value) || 0,
      };
    })
  );

  const kpis = [
    { label: "Total Companies", value: totalCompaniesResult[0]?.value ?? 0 },
    { label: "Attempted", value: Number(attemptedResult[0]?.value) || 0 },
    { label: "Connected", value: Number(connectedResult[0]?.value) || 0 },
    {
      label: "Reqs Validated",
      value: reqsValidatedResult[0]?.value ?? 0,
    },
    {
      label: "Openings Validated",
      value: Number(openingsResult[0]?.value) || 0,
    },
    {
      label: "Handed Over",
      value: handedOverResult[0]?.value ?? 0,
      sub: `S ${handedOverSResult[0]?.value ?? 0} · C ${handedOverCResult[0]?.value ?? 0} · A ${handedOverAResult[0]?.value ?? 0}`,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Team performance overview
          </p>
        </div>
        <PeriodSelector />
      </div>

      <KpiCards items={kpis} />

      <div className="mt-6">
        <CallerTable rows={callerRows} />
      </div>
    </div>
  );
}
