"use client";

import { Badge } from "@/components/ui/badge";

export type HandedOverItem = {
  companyCode: string;
  companyName: string;
  roleName: string;
  classification: string | null;
};

function classificationBadge(classification: string | null) {
  switch (classification) {
    case "kaushalam":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
          Scheduling
        </Badge>
      );
    case "collector":
      return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[11px]">
          Collector
        </Badge>
      );
    case "apssdc":
      return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[11px]">
          APSSDC
        </Badge>
      );
    default:
      return null;
  }
}

export function HandedOverPanel({ items }: { items: HandedOverItem[] }) {
  return (
    <div className="bg-card border rounded-md">
      <div className="px-4 py-2.5 border-b">
        <h2 className="text-sm font-semibold">Handed over this week</h2>
      </div>
      <div className="p-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            None this week
          </p>
        ) : (
          items.map((item, i) => (
            <div key={`${item.companyCode}-${i}`} className="flex items-center justify-between text-sm">
              <span className="truncate mr-2">{item.companyName}</span>
              {classificationBadge(item.classification)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
