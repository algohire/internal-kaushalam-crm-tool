import { requireAuth, todayDate, daysBetween } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { task, company, requirement } from "@/lib/db/schema";
import { eq, and, lte, lt, gte, sql, asc, isNull, or, count } from "drizzle-orm";
import { KpiCards, type KpiData } from "@/components/today/kpi-cards";
import { TaskTable, type TaskRow } from "@/components/today/task-table";
import {
  HandedOverPanel,
  type HandedOverItem,
} from "@/components/today/handed-over-panel";

const TASK_PAGE_SIZE = 20;

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function getSunday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const today = todayDate();
  const monday = getMonday();
  const sunday = getSunday();
  const userId = session.user.id;

  const activeTab = (typeof params.taskTab === "string" ? params.taskTab : "today") as "today" | "week" | "unassigned";
  const taskPage = Math.max(1, parseInt(typeof params.taskPage === "string" ? params.taskPage : "1", 10) || 1);

  // ── KPI queries (parallel) ──
  const [
    [dueTodayResult],
    [overdueResult],
    [validatedResult],
    handedOverRows,
    [pendingValidationResult],
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(task)
      .where(and(eq(task.status, "open"), lte(task.dueDate, today), or(eq(task.userId, userId), isNull(task.userId)))),
    db.select({ count: sql<number>`count(*)::int`, oldestDate: sql<string>`min(${task.dueDate})` }).from(task)
      .where(and(eq(task.status, "open"), lt(task.dueDate, today), or(eq(task.userId, userId), isNull(task.userId)))),
    db.select({ count: sql<number>`count(*)::int` }).from(requirement)
      .where(and(sql`${requirement.requiredCountValidated} > 0`, sql`${requirement.updatedAt} >= ${monday}`)),
    db.select({ status: requirement.status, count: sql<number>`count(*)::int` }).from(requirement)
      .where(and(sql`${requirement.status} like 'handed_over_%'`, sql`${requirement.handedOverAt} >= ${monday}`))
      .groupBy(requirement.status),
    db.select({ count: sql<number>`count(*)::int` }).from(requirement)
      .where(and(
        eq(requirement.status, "captured"),
        sql`(${requirement.requiredCountValidated} IS NULL OR ${requirement.requiredCountValidated} = 0)`
      )),
  ]);

  const handedOverByRoute = { scheduling: 0, collector: 0, apssdc: 0 };
  for (const row of handedOverRows) {
    if (row.status === "handed_over_scheduling") handedOverByRoute.scheduling = row.count;
    else if (row.status === "handed_over_collector") handedOverByRoute.collector = row.count;
    else if (row.status === "handed_over_apssdc") handedOverByRoute.apssdc = row.count;
  }

  const kpiData: KpiData = {
    dueToday: dueTodayResult.count,
    overdue: overdueResult.count,
    oldestOverdueDays: overdueResult.oldestDate ? daysBetween(overdueResult.oldestDate) : null,
    validatedThisWeek: validatedResult.count,
    handedOverScheduling: handedOverByRoute.scheduling,
    handedOverCollector: handedOverByRoute.collector,
    handedOverApssdc: handedOverByRoute.apssdc,
    rolesPendingValidation: pendingValidationResult.count,
  };

  // ── Build tab-specific WHERE ──
  const baseCondition = and(eq(task.status, "open"), or(eq(task.userId, userId), isNull(task.userId)));

  let tabCondition;
  let orderBy;
  if (activeTab === "today") {
    tabCondition = and(baseCondition, lte(task.dueDate, today));
    orderBy = asc(task.dueDate);
  } else if (activeTab === "week") {
    tabCondition = and(baseCondition, gte(task.dueDate, monday), lte(task.dueDate, sunday));
    orderBy = asc(task.dueDate);
  } else {
    tabCondition = and(eq(task.status, "open"), isNull(task.userId));
    orderBy = asc(company.companyRank);
  }

  // ── Count + paginated query + handed over (parallel) ──
  const [
    [{ total }],
    openTasks,
    handedOverItems,
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(task)
      .innerJoin(company, eq(task.companyCode, company.companyCode)).where(tabCondition),
    db.select({
      id: task.id, companyCode: task.companyCode, companyName: company.companyName,
      sector: company.sector, district: company.district, title: task.title,
      source: task.source, dueDate: task.dueDate, userId: task.userId, companyRank: company.companyRank,
    }).from(task).innerJoin(company, eq(task.companyCode, company.companyCode))
      .where(tabCondition).orderBy(orderBy).limit(TASK_PAGE_SIZE).offset((taskPage - 1) * TASK_PAGE_SIZE),
    db.select({
      companyCode: requirement.companyCode, companyName: company.companyName,
      roleName: requirement.roleName, classification: requirement.classification,
    }).from(requirement).innerJoin(company, eq(requirement.companyCode, company.companyCode))
      .where(and(sql`${requirement.status} like 'handed_over_%'`, sql`${requirement.handedOverAt} >= ${monday}`)),
  ]);

  const handedOverData: HandedOverItem[] = handedOverItems.map((r) => ({
    companyCode: r.companyCode,
    companyName: r.companyName,
    roleName: r.roleName,
    classification: r.classification,
  }));

  const tasks: TaskRow[] = openTasks.map((row) => ({
    id: row.id,
    companyCode: row.companyCode,
    companyName: row.companyName,
    sector: row.sector,
    district: row.district,
    title: row.title,
    source: row.source,
    dueDate: row.dueDate,
    overdueDays: row.dueDate < today ? daysBetween(row.dueDate) : 0,
    userId: row.userId,
    companyRank: row.companyRank,
  }));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">My day</h1>
        <p className="text-sm text-muted-foreground">
          Tasks come from your own next steps and from system hooks. Overdue items stay here and age; they do not roll forward.
        </p>
      </div>

      <KpiCards data={kpiData} />

      <div className="mt-4 flex gap-4">
        <div className="flex-[3]">
          <TaskTable
            tasks={tasks}
            total={total}
            page={taskPage}
            pageSize={TASK_PAGE_SIZE}
            activeTab={activeTab}
            today={today}
          />
        </div>
        <div className="flex-1">
          <HandedOverPanel items={handedOverData} />
        </div>
      </div>
    </div>
  );
}
