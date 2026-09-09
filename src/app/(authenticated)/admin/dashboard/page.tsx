import { db } from "@/lib/db";
import { company, interaction, requirement, task, user } from "@/lib/db/schema";
import { eq, and, gte, gt, like, isNotNull, sql, count, sum, lt, desc } from "drizzle-orm";
import { requireAdmin, todayDate } from "@/lib/auth-utils";
import { KpiCards } from "@/components/admin/kpi-cards";
import { CallerTable, type CallerRow } from "@/components/admin/caller-table";
import { PeriodSelector } from "@/components/admin/period-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CONNECTED_DISPOSITIONS = [
  "hiring_now", "hiring_later", "no_requirement",
  "not_operational", "do_not_call",
];

function periodRange(period: string): { start: string | null; end: string | null } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  switch (period) {
    case "today":
      return { start: todayStr, end: null };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: y.toISOString().split("T")[0], end: todayStr };
    }
    case "week": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      return { start: monday.toISOString().split("T")[0], end: null };
    }
    case "month":
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end: null };
    case "all":
      return { start: null, end: null };
    default:
      return { start: null, end: null };
  }
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const period = params.period || "today";
  const { start: startDate, end: endDate } = periodRange(period);
  const today = todayDate();

  const timeFilter = startDate
    ? endDate
      ? and(gte(interaction.createdAt, startDate), lt(interaction.createdAt, endDate))
      : gte(interaction.createdAt, startDate)
    : undefined;
  const reqTimeFilter = startDate
    ? endDate
      ? and(gte(requirement.updatedAt, startDate), lt(requirement.updatedAt, endDate))
      : gte(requirement.updatedAt, startDate)
    : undefined;

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
    // Calling outcome metrics
    totalCallsResult,
    dispositionBreakdown,
    // Opening metrics
    totalOpeningsEdb,
    openingsValidated,
    avgOpeningsPerReq,
    // Funnel
    funnelAttempted,
    funnelConnected,
    funnelValidated,
    funnelHandedOver,
    // Tasks
    overdueTasksResult,
    tasksDueTodayResult,
    // Recent activity
    recentInteractions,
    // Per-caller stats
    callerStats,
    // District breakdown
    districtBreakdown,
    // Tier breakdown
    tierBreakdown,
    // Openings by qualification
    qualificationBreakdown,
  ] = await Promise.all([
    db.select({ value: count() }).from(company),
    db.select({ value: sql<number>`COUNT(DISTINCT ${interaction.companyCode})` })
      .from(interaction).where(timeFilter),
    db.select({ value: sql<number>`COUNT(DISTINCT ${interaction.companyCode})` })
      .from(interaction)
      .where(and(
        sql`${interaction.disposition} IN (${sql.join(CONNECTED_DISPOSITIONS.map((d) => sql`${d}`), sql`, `)})`,
        timeFilter
      )),
    db.select({ value: count() }).from(requirement)
      .where(and(gt(requirement.requiredCountValidated, 0), reqTimeFilter)),
    db.select({ value: sum(requirement.requiredCountValidated) }).from(requirement)
      .where(and(gt(requirement.requiredCountValidated, 0), reqTimeFilter)),
    db.select({ value: count() }).from(requirement)
      .where(and(like(requirement.status, "handed_over_%"), startDate ? (endDate ? and(gte(requirement.handedOverAt, startDate), lt(requirement.handedOverAt, endDate)) : gte(requirement.handedOverAt, startDate)) : undefined)),
    db.select({ value: count() }).from(requirement)
      .where(and(eq(requirement.status, "handed_over_scheduling"), startDate ? (endDate ? and(gte(requirement.handedOverAt, startDate), lt(requirement.handedOverAt, endDate)) : gte(requirement.handedOverAt, startDate)) : undefined)),
    db.select({ value: count() }).from(requirement)
      .where(and(eq(requirement.status, "handed_over_collector"), startDate ? (endDate ? and(gte(requirement.handedOverAt, startDate), lt(requirement.handedOverAt, endDate)) : gte(requirement.handedOverAt, startDate)) : undefined)),
    db.select({ value: count() }).from(requirement)
      .where(and(eq(requirement.status, "handed_over_apssdc"), startDate ? (endDate ? and(gte(requirement.handedOverAt, startDate), lt(requirement.handedOverAt, endDate)) : gte(requirement.handedOverAt, startDate)) : undefined)),

    // Total calls in period
    db.select({ value: count() }).from(interaction).where(timeFilter),

    // Disposition breakdown
    db.select({
      disposition: interaction.disposition,
      cnt: count(),
    }).from(interaction).where(timeFilter).groupBy(interaction.disposition),

    // Total openings from EDB
    db.select({ value: sql<number>`COALESCE(SUM(${requirement.requiredCount}), 0)` }).from(requirement),

    // Openings validated
    db.select({ value: sql<number>`COALESCE(SUM(${requirement.requiredCountValidated}), 0)` })
      .from(requirement).where(gt(requirement.requiredCountValidated, 0)),

    // Avg openings per requirement
    db.select({ value: sql<number>`COALESCE(AVG(${requirement.requiredCountValidated}), 0)` })
      .from(requirement).where(gt(requirement.requiredCountValidated, 0)),

    // Funnel - attempted (all time)
    db.select({ value: sql<number>`COUNT(DISTINCT ${interaction.companyCode})` }).from(interaction),
    // Funnel - connected (all time)
    db.select({ value: sql<number>`COUNT(DISTINCT ${interaction.companyCode})` }).from(interaction)
      .where(sql`${interaction.disposition} IN (${sql.join(CONNECTED_DISPOSITIONS.map((d) => sql`${d}`), sql`, `)})`),
    // Funnel - validated (all time)
    db.select({ value: sql<number>`COUNT(DISTINCT ${requirement.companyCode})` }).from(requirement)
      .where(gt(requirement.requiredCountValidated, 0)),
    // Funnel - handed over (all time)
    db.select({ value: sql<number>`COUNT(DISTINCT ${requirement.companyCode})` }).from(requirement)
      .where(like(requirement.status, "handed_over_%")),

    // Overdue tasks
    db.select({ value: count() }).from(task)
      .where(and(eq(task.status, "open"), lt(task.dueDate, today))),
    // Tasks due today
    db.select({ value: count() }).from(task)
      .where(and(eq(task.status, "open"), eq(task.dueDate, today))),

    // Recent 10 interactions
    db.select({
      companyCode: interaction.companyCode,
      username: interaction.username,
      disposition: interaction.disposition,
      channel: interaction.channel,
      createdAt: interaction.createdAt,
      companyName: company.companyName,
    }).from(interaction)
      .leftJoin(company, eq(interaction.companyCode, company.companyCode))
      .orderBy(desc(interaction.createdAt))
      .limit(10),

    // Per-caller stats
    db.select({
      userId: user.id,
      userName: user.name,
      dials: sql<number>`COUNT(${interaction.id})`,
      connects: sql<number>`COUNT(CASE WHEN ${interaction.disposition} IN ('hiring_now','hiring_later','no_requirement','not_operational','do_not_call') THEN 1 END)`,
    }).from(user)
      .leftJoin(interaction, and(eq(user.id, interaction.userId), timeFilter))
      .where(eq(user.active, true))
      .groupBy(user.id, user.name),

    // District breakdown
    db.select({
      district: company.district,
      companies: count(),
      openings: sql<number>`COALESCE(SUM(${company.totalRequired}), 0)`,
    }).from(company)
      .where(isNotNull(company.district))
      .groupBy(company.district)
      .orderBy(desc(sql`COALESCE(SUM(${company.totalRequired}), 0)`))
      .limit(15),

    // Tier breakdown
    db.select({
      tier: company.tier,
      companies: count(),
      openings: sql<number>`COALESCE(SUM(${company.totalRequired}), 0)`,
    }).from(company)
      .where(isNotNull(company.tier))
      .groupBy(company.tier)
      .orderBy(company.tier),

    // Openings by qualification
    db.select({
      qualification: requirement.qualification,
      roles: count(),
      openings: sql<number>`COALESCE(SUM(${requirement.requiredCountValidated}), 0)`,
    }).from(requirement)
      .where(isNotNull(requirement.qualification))
      .groupBy(requirement.qualification)
      .orderBy(desc(sql`COALESCE(SUM(${requirement.requiredCountValidated}), 0)`)),
  ]);

  // Per-caller enrichment
  const callerRows: CallerRow[] = await Promise.all(
    callerStats.map(async (cs) => {
      const [reqStats] = await db.select({
        validated: sql<number>`COUNT(CASE WHEN ${requirement.requiredCountValidated} IS NOT NULL THEN 1 END)`,
        openings: sql<number>`COALESCE(SUM(${requirement.requiredCountValidated}), 0)`,
        handoffsS: sql<number>`COUNT(CASE WHEN ${requirement.status} = 'handed_over_scheduling' THEN 1 END)`,
        handoffsC: sql<number>`COUNT(CASE WHEN ${requirement.status} = 'handed_over_collector' THEN 1 END)`,
        handoffsA: sql<number>`COUNT(CASE WHEN ${requirement.status} = 'handed_over_apssdc' THEN 1 END)`,
      }).from(requirement).where(and(eq(requirement.updatedBy, cs.userId), reqTimeFilter));

      const [overdueResult] = await db.select({ value: count() }).from(task)
        .where(and(eq(task.userId, cs.userId), eq(task.status, "open"), sql`${task.dueDate} < ${today}`));

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

  const totalCompanies = totalCompaniesResult[0]?.value ?? 0;
  const attempted = Number(attemptedResult[0]?.value) || 0;
  const connected = Number(connectedResult[0]?.value) || 0;
  const totalCalls = totalCallsResult[0]?.value ?? 0;

  const kpis = [
    { label: "Total Companies", value: totalCompanies },
    { label: "Attempted", value: attempted },
    { label: "Connected", value: connected },
    { label: "Reqs Validated", value: reqsValidatedResult[0]?.value ?? 0 },
    { label: "Openings Validated", value: Number(openingsResult[0]?.value) || 0 },
    { label: "Handed Over", value: handedOverResult[0]?.value ?? 0,
      sub: `S ${handedOverSResult[0]?.value ?? 0} · C ${handedOverCResult[0]?.value ?? 0} · A ${handedOverAResult[0]?.value ?? 0}` },
  ];

  // Disposition map for labels
  const dispLabels: Record<string, string> = {
    no_answer: "No answer", wrong_contact: "Wrong contact", hiring_now: "Hiring now",
    hiring_later: "Hiring later", no_requirement: "No requirement",
    not_operational: "Not operational", do_not_call: "Do not call", duplicate: "Duplicate",
  };

  const dispColors: Record<string, string> = {
    hiring_now: "bg-green-50 text-green-700 border-green-200",
    hiring_later: "bg-amber-50 text-amber-700 border-amber-200",
    no_answer: "bg-red-50 text-red-700 border-red-200",
    wrong_contact: "bg-red-50 text-red-700 border-red-200",
    no_requirement: "bg-gray-100 text-gray-600",
    not_operational: "bg-gray-100 text-gray-600",
    do_not_call: "bg-gray-100 text-gray-600",
    duplicate: "bg-gray-100 text-gray-600",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Team performance overview</p>
        </div>
        <PeriodSelector />
      </div>

      <KpiCards items={kpis} />

      {/* Calling Outcome Metrics + Opening Metrics */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Calling Outcomes</CardTitle>
            <p className="text-xs text-muted-foreground">{totalCalls} total calls in period</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {dispositionBreakdown
              .sort((a, b) => b.cnt - a.cnt)
              .map((d) => {
                const pct = totalCalls > 0 ? Math.round((d.cnt / totalCalls) * 100) : 0;
                return (
                  <div key={d.disposition} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${dispColors[d.disposition] || "bg-gray-100 text-gray-600"}`}>
                        {dispLabels[d.disposition] || d.disposition}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground text-xs">{pct}%</span>
                      <span className="font-medium w-8 text-right">{d.cnt}</span>
                    </div>
                  </div>
                );
              })}
            {dispositionBreakdown.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No calls in this period</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Opening Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total openings (EDB)</span>
              <span className="font-semibold tabular-nums">{Number(totalOpeningsEdb[0]?.value || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Openings validated</span>
              <span className="font-semibold tabular-nums">{Number(openingsValidated[0]?.value || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg per requirement</span>
              <span className="font-semibold tabular-nums">{Math.round(Number(avgOpeningsPerReq[0]?.value || 0))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Validation rate</span>
              <span className="font-semibold tabular-nums">
                {Number(totalOpeningsEdb[0]?.value) > 0
                  ? `${Math.round((Number(openingsValidated[0]?.value || 0) / Number(totalOpeningsEdb[0]?.value)) * 100)}%`
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due today</span>
              <span className="font-semibold tabular-nums">{tasksDueTodayResult[0]?.value ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overdue</span>
              <span className="font-semibold tabular-nums text-red-600">{overdueTasksResult[0]?.value ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Funnel (cumulative, all time)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-0 text-center text-xs">
            {[
              { label: "Universe", value: totalCompanies, color: "bg-gray-100" },
              { label: "Attempted", value: Number(funnelAttempted[0]?.value || 0), color: "bg-blue-50" },
              { label: "Connected", value: Number(funnelConnected[0]?.value || 0), color: "bg-blue-100" },
              { label: "Validated", value: Number(funnelValidated[0]?.value || 0), color: "bg-green-50" },
              { label: "Handed Over", value: Number(funnelHandedOver[0]?.value || 0), color: "bg-green-100" },
            ].map((step, i, arr) => {
              const prev = i > 0 ? arr[i - 1].value : 0;
              const convPct = prev > 0 ? Math.round((step.value / prev) * 100) : 0;
              return (
                <div key={step.label} className={`flex-1 py-3 px-2 ${step.color} ${i === 0 ? "rounded-l-md" : ""} ${i === arr.length - 1 ? "rounded-r-md" : ""} border-r border-white`}>
                  <div className="font-semibold text-base tabular-nums">{step.value.toLocaleString()}</div>
                  <div className="text-muted-foreground mt-0.5">{step.label}</div>
                  {i > 0 && <div className="text-[10px] text-muted-foreground mt-0.5">{convPct}%</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Qualification Breakdown + Handover Breakdown */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Openings by Qualification</CardTitle>
            <p className="text-xs text-muted-foreground">Validated roles grouped by required qualification</p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Qualification</th>
                  <th className="text-right px-4 py-2 font-medium">Roles</th>
                  <th className="text-right px-4 py-2 font-medium">Openings</th>
                </tr>
              </thead>
              <tbody>
                {qualificationBreakdown.map((q) => (
                  <tr key={q.qualification} className="border-b last:border-0">
                    <td className="px-4 py-1.5">{q.qualification || "—"}</td>
                    <td className="text-right px-4 py-1.5 tabular-nums">{q.roles}</td>
                    <td className="text-right px-4 py-1.5 tabular-nums font-medium">{Number(q.openings).toLocaleString()}</td>
                  </tr>
                ))}
                {qualificationBreakdown.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-muted-foreground py-6 text-sm">No validated requirements yet</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Handover Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">Requirements handed over by route</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Kaushalam (Direct Hiring → Scheduling)", value: handedOverSResult[0]?.value ?? 0, color: "bg-green-500" },
              { label: "Collector (Local Mobilisation)", value: handedOverCResult[0]?.value ?? 0, color: "bg-[#D9601F]" },
              { label: "APSSDC (Needs Training)", value: handedOverAResult[0]?.value ?? 0, color: "bg-blue-500" },
            ].map((route) => {
              const total = (handedOverResult[0]?.value ?? 0) || 1;
              const pct = Math.round((Number(route.value) / Number(total)) * 100);
              return (
                <div key={route.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{route.label}</span>
                    <span className="font-semibold tabular-nums">{Number(route.value)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${route.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{pct}% of total</div>
                </div>
              );
            })}
            <div className="pt-2 border-t flex justify-between text-sm font-medium">
              <span>Total handed over</span>
              <span className="tabular-nums">{handedOverResult[0]?.value ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-caller table */}
      <div className="mt-6">
        <CallerTable rows={callerRows} />
      </div>

      {/* District + Tier breakdown + Recent activity */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Top Districts by Openings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">District</th>
                  <th className="text-right px-4 py-2 font-medium">Companies</th>
                  <th className="text-right px-4 py-2 font-medium">Openings</th>
                </tr>
              </thead>
              <tbody>
                {districtBreakdown.map((d) => (
                  <tr key={d.district} className="border-b last:border-0">
                    <td className="px-4 py-1.5">{d.district || "—"}</td>
                    <td className="text-right px-4 py-1.5 tabular-nums">{d.companies}</td>
                    <td className="text-right px-4 py-1.5 tabular-nums font-medium">{Number(d.openings).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">By Tier</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Tier</th>
                  <th className="text-right px-4 py-2 font-medium">Companies</th>
                  <th className="text-right px-4 py-2 font-medium">Openings</th>
                </tr>
              </thead>
              <tbody>
                {tierBreakdown.map((t) => (
                  <tr key={t.tier} className="border-b last:border-0">
                    <td className="px-4 py-1.5">
                      <Badge variant="outline" className="text-xs">Tier {t.tier}</Badge>
                    </td>
                    <td className="text-right px-4 py-1.5 tabular-nums">{t.companies}</td>
                    <td className="text-right px-4 py-1.5 tabular-nums font-medium">{Number(t.openings).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentInteractions.map((i, idx) => (
              <div key={idx} className="text-xs flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#620124] mt-1.5 shrink-0" />
                <div>
                  <span className="font-medium">{i.username}</span>{" "}
                  <Badge variant="outline" className={`text-[10px] ${dispColors[i.disposition] || ""}`}>
                    {dispLabels[i.disposition] || i.disposition}
                  </Badge>{" "}
                  <span className="text-muted-foreground">{i.companyName || i.companyCode}</span>
                  <div className="text-muted-foreground">
                    {new Date(i.createdAt).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
            {recentInteractions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
