"use client";

import { cn } from "@/lib/utils";

type KpiCardProps = {
  value: number | string;
  label: string;
  detail?: string;
  variant?: "default" | "bad" | "warn";
};

function KpiCard({ value, label, detail, variant = "default" }: KpiCardProps) {
  return (
    <div className="bg-card border rounded-md p-3.5">
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums leading-tight",
          variant === "bad" && "text-red-600",
          variant === "warn" && "text-amber-600"
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {detail && (
        <div className="text-xs text-muted-foreground mt-1.5">{detail}</div>
      )}
    </div>
  );
}

export type KpiData = {
  dueToday: number;
  overdue: number;
  oldestOverdueDays: number | null;
  validatedThisWeek: number;
  handedOverScheduling: number;
  handedOverCollector: number;
  handedOverApssdc: number;
};

export function KpiCards({ data }: { data: KpiData }) {
  const totalHandedOver =
    data.handedOverScheduling +
    data.handedOverCollector +
    data.handedOverApssdc;

  const handedOverDetail = [
    data.handedOverScheduling > 0 &&
      `${data.handedOverScheduling} Scheduling`,
    data.handedOverCollector > 0 &&
      `${data.handedOverCollector} Collector`,
    data.handedOverApssdc > 0 && `${data.handedOverApssdc} APSSDC`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid grid-cols-4 gap-3">
      <KpiCard value={data.dueToday} label="Due today" />
      <KpiCard
        value={data.overdue}
        label="Overdue"
        detail={
          data.oldestOverdueDays
            ? `Oldest ${data.oldestOverdueDays} days`
            : undefined
        }
        variant={data.overdue > 0 ? "bad" : "default"}
      />
      <KpiCard value={data.validatedThisWeek} label="Validated this week" />
      <KpiCard
        value={totalHandedOver}
        label="Handed over this week"
        detail={handedOverDetail || undefined}
      />
    </div>
  );
}
