"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

export function HandedOverPanel({
  items,
  total,
  page,
  pageSize,
}: {
  items: HandedOverItem[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  function pageHref(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("hoPage", String(p));
    return `/today?${params.toString()}`;
  }

  return (
    <div className="bg-card border rounded-md">
      <div className="px-4 py-2.5 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">Handed over this week</h2>
        <span className="text-xs text-muted-foreground">{total}</span>
      </div>
      <div className="p-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            None this week
          </p>
        ) : (
          items.map((item, i) => (
            <div key={`${item.companyCode}-${i}`} className="flex items-center justify-between text-sm">
              <div className="truncate mr-2">
                <Link
                  href={`/company/${item.companyCode}`}
                  className="hover:underline text-[#620124]"
                >
                  {item.companyName}
                </Link>
                <div className="text-xs text-muted-foreground truncate">{item.roleName}</div>
              </div>
              {classificationBadge(item.classification)}
            </div>
          ))
        )}
      </div>
      {total > pageSize && (
        <div className="px-3 py-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>{start}–{end} of {total}</span>
          <div className="flex gap-1.5">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="px-2 py-0.5 border rounded hover:bg-muted" prefetch={false}>
                ←
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="px-2 py-0.5 border rounded hover:bg-muted" prefetch={false}>
                →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
