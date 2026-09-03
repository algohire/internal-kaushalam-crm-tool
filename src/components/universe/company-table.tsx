"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateIST } from "@/lib/date-utils";
import { toggleBookmark } from "@/lib/actions/company";
import { Bookmark } from "lucide-react";

export interface CompanyRow {
  companyCode: string;
  companyName: string;
  sector: string | null;
  subsectors: string | null;
  district: string | null;
  mandal: string | null;
  presentHeadcount: number | null;
  totalRequired: number | null;
  tier: number | null;
  flags: string | null;
  tags: string | null;
  lastDisposition: string | null;
  lastContactAt: string | null;
  contactCount: number;
  requirementCount: number;
  bookmarked: boolean;
}

interface CompanyTableProps {
  companies: CompanyRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function CompanyTable({
  companies,
  total,
  page,
  pageSize,
}: CompanyTableProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="bg-card border rounded-md">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>District · Mandal</TableHead>
              <TableHead className="text-right">Staff</TableHead>
              <TableHead className="text-right">Requirement</TableHead>
              <TableHead className="text-right">Tier</TableHead>
              <TableHead>Last contact</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No companies match the current filters.
                </TableCell>
              </TableRow>
            )}
            {companies.map((c) => {
              const flagList = c.flags
                ? c.flags.split(";").filter(Boolean)
                : [];
              const tagList = c.tags
                ? c.tags.split(";").filter(Boolean)
                : [];

              return (
                <TableRow key={c.companyCode} className="hover:bg-muted/30">
                  <TableCell>
                    <Link
                      href={`/company/${c.companyCode}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.companyName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {c.companyCode}
                    </div>
                    {flagList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {flagList.map((f) => (
                          <Badge
                            key={f}
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                          >
                            {f.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{c.sector ?? "—"}</div>
                    {c.subsectors && (
                      <div className="text-xs text-muted-foreground truncate max-w-40">
                        {c.subsectors}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{c.district ?? "—"}</div>
                    {c.mandal && (
                      <div className="text-xs text-muted-foreground">
                        {c.mandal}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.presentHeadcount?.toLocaleString() ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div>{c.totalRequired?.toLocaleString() ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.requirementCount} role{c.requirementCount !== 1 ? "s" : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.tier ?? "—"}
                  </TableCell>
                  <TableCell>
                    {c.lastContactAt ? (
                      <>
                        <div className="tabular-nums">
                          {formatDateIST(c.lastContactAt)}
                        </div>
                        {c.lastDisposition && (
                          <div className="text-xs text-muted-foreground">
                            {c.lastDisposition.replace(/_/g, " ")}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.contactCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tagList.map((t) => (
                        <span
                          key={t}
                          className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleBookmark(c.companyCode);
                      }}
                      className="p-1 rounded hover:bg-muted"
                      title={c.bookmarked ? "Remove bookmark" : "Bookmark"}
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          c.bookmarked
                            ? "fill-[#D9601F] text-[#D9601F]"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
        <span>
          Showing {total > 0 ? start : 0}–{end} of {total.toLocaleString()}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <PaginationLink page={page - 1} label="Previous" />
          )}
          {page < totalPages && (
            <PaginationLink page={page + 1} label="Next" />
          )}
        </div>
      </div>
    </div>
  );
}

function PaginationLink({ page, label }: { page: number; label: string }) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(page));

  return (
    <Link
      href={`/universe?${params.toString()}`}
      className="px-3 py-1 border rounded text-sm hover:bg-muted"
      prefetch={false}
    >
      {label}
    </Link>
  );
}
