import Link from "next/link";
import { db } from "@/lib/db";
import { requirement, company, contact } from "@/lib/db/schema";
import { eq, like, and, gte, lte, sql, count } from "drizzle-orm";
import { requireAuth, formatDateIST } from "@/lib/auth-utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/components/handed-over/export-button";
import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 25;

function classificationBadge(status: string) {
  if (status === "handed_over_scheduling") {
    return <Badge className="bg-green-50 text-green-700 border-green-200">Scheduling</Badge>;
  }
  if (status === "handed_over_collector") {
    return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Collector</Badge>;
  }
  if (status === "handed_over_apssdc") {
    return <Badge className="bg-gray-100 text-gray-600 border-gray-200">APSSDC</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default async function HandedOverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const params = await searchParams;
  const route = typeof params.route === "string" ? params.route : "";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);

  const conditions = [like(requirement.status, "handed_over_%")];

  if (route === "scheduling") {
    conditions.push(eq(requirement.status, "handed_over_scheduling"));
  } else if (route === "collector") {
    conditions.push(eq(requirement.status, "handed_over_collector"));
  } else if (route === "apssdc") {
    conditions.push(eq(requirement.status, "handed_over_apssdc"));
  }

  if (from) {
    conditions.push(gte(requirement.handedOverAt, from));
  }
  if (to) {
    conditions.push(lte(requirement.handedOverAt, to + "T23:59:59Z"));
  }

  const whereClause = and(...conditions);

  const [[{ total }], rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(requirement)
      .innerJoin(company, eq(requirement.companyCode, company.companyCode))
      .where(whereClause),
    db
      .select({
        reqId: requirement.id,
        companyCode: requirement.companyCode,
        companyName: company.companyName,
        roleName: requirement.roleName,
        roleNameEdited: requirement.roleNameEdited,
        requiredCountValidated: requirement.requiredCountValidated,
        qualification: requirement.qualification,
        experience: requirement.experience,
        classification: requirement.classification,
        collectorDistrict: requirement.collectorDistrict,
        handoffComment: requirement.handoffComment,
        handedOverBy: requirement.handedOverBy,
        handedOverAt: requirement.handedOverAt,
        status: requirement.status,
        contactName: contact.name,
        contactMobile: contact.mobile,
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
      .where(whereClause)
      .orderBy(sql`${requirement.handedOverAt} DESC NULLS LAST`)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const start = total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (route) sp.set("route", route);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("page", String(p));
    return `/handed-over?${sp.toString()}`;
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Handed Over</h1>
          <p className="text-sm text-muted-foreground">
            Requirements handed over for placement. {total.toLocaleString()} records.
          </p>
        </div>
        <Suspense fallback={null}>
          <ExportButton />
        </Suspense>
      </div>

      <form className="flex items-end gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Route</label>
          <select
            name="route"
            defaultValue={route}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All routes</option>
            <option value="scheduling">Scheduling</option>
            <option value="collector">Collector</option>
            <option value="apssdc">APSSDC</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <Input type="date" name="from" defaultValue={from} className="w-40 h-9" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <Input type="date" name="to" defaultValue={to} className="w-40 h-9" />
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-[#620124] text-white text-sm font-medium hover:bg-[#7B1A36]"
        >
          Filter
        </button>
      </form>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead>Qualification</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Handoff Comment</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  No handed-over requirements found.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.reqId}>
                <TableCell>
                  <Link href={`/company/${r.companyCode}`} className="font-medium text-sm text-[#620124] hover:underline">
                    {r.companyName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.companyCode}</div>
                </TableCell>
                <TableCell className="text-sm">{r.roleNameEdited || r.roleName}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {r.requiredCountValidated ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{r.qualification || "—"}</TableCell>
                <TableCell className="text-sm">{r.experience || "—"}</TableCell>
                <TableCell>{classificationBadge(r.status)}</TableCell>
                <TableCell className="text-sm">{r.collectorDistrict || "—"}</TableCell>
                <TableCell className="text-sm max-w-48 truncate" title={r.handoffComment || ""}>
                  {r.handoffComment || "—"}
                </TableCell>
                <TableCell className="text-sm">{r.handedOverBy || "—"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {r.handedOverAt ? formatDateIST(r.handedOverAt) : "—"}
                </TableCell>
                <TableCell>
                  {r.contactName ? (
                    <div>
                      <div className="text-sm">{r.contactName}</div>
                      {r.contactMobile && (
                        <a href={`tel:${r.contactMobile}`} className="text-xs text-[#620124]">
                          {r.contactMobile}
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
            <span>Showing {start}–{end} of {total.toLocaleString()}</span>
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
    </div>
  );
}
