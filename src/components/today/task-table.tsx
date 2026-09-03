"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TaskRow = {
  id: string;
  companyCode: string;
  companyName: string;
  sector: string | null;
  district: string | null;
  title: string;
  source: string;
  dueDate: string;
  overdueDays: number;
  userId: string | null;
  companyRank: number | null;
};

type TabKey = "today" | "week" | "unassigned";

export function TaskTable({
  tasks,
  total,
  page,
  pageSize,
  activeTab,
  today,
}: {
  tasks: TaskRow[];
  total: number;
  page: number;
  pageSize: number;
  activeTab: TabKey;
  today: string;
}) {
  const searchParams = useSearchParams();
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  function tabHref(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskTab", tab);
    params.delete("taskPage");
    return `/today?${params.toString()}`;
  }

  function pageHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskPage", String(p));
    params.set("taskTab", activeTab);
    return `/today?${params.toString()}`;
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "today", label: "Today & overdue" },
    { key: "week", label: "This week" },
    { key: "unassigned", label: "Unassigned" },
  ];

  return (
    <div className="bg-card border rounded-md">
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Tasks</h2>
          <span className="text-xs text-muted-foreground">{total}</span>
        </div>
        <div className="flex gap-0.5 border-b">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              prefetch={false}
              className={`px-3 py-1.5 text-xs border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? "border-[#620124] text-[#620124] font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Next step</TableHead>
              <TableHead>Set by</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Age</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No tasks
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link
                      href={`/company/${t.companyCode}`}
                      className="font-medium text-sm hover:underline text-[#620124]"
                    >
                      {t.companyName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[t.district, t.sector].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-[300px]">{t.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {t.source === "next_step"
                      ? "Caller"
                      : t.source === "retry"
                        ? "System, retry"
                        : t.source === "new_requirement"
                          ? "System, new req"
                          : t.source}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums whitespace-nowrap">
                    {formatDueDate(t.dueDate, today)}
                  </TableCell>
                  <TableCell>
                    {t.overdueDays > 0 && (
                      <Badge variant="destructive" className="text-[11px] font-medium">
                        {t.overdueDays} {t.overdueDays === 1 ? "day" : "days"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/company/${t.companyCode}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Open
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
          <span>Showing {start}–{end} of {total}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="px-3 py-1 border rounded text-sm hover:bg-muted" prefetch={false}>
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="px-3 py-1 border rounded text-sm hover:bg-muted" prefetch={false}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDueDate(dueDate: string, today: string): string {
  if (dueDate === today) return "Today";
  const d = new Date(dueDate);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}
