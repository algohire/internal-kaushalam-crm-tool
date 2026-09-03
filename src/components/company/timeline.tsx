import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Interaction = {
  id: string;
  username: string;
  team: string;
  channel: string;
  disposition: string;
  comment: string;
  nextStep: string;
  nextActionDate: string;
  fieldsChangedJson: string | null;
  source: string;
  createdAt: string;
};

function dispositionLabel(code: string): string {
  const map: Record<string, string> = {
    no_answer: "No answer",
    wrong_contact: "Wrong contact",
    hiring_now: "Hiring now",
    hiring_later: "Hiring later",
    no_requirement: "No requirement",
    not_operational: "Not operational",
    do_not_call: "Do not call",
    duplicate: "Duplicate",
  };
  return map[code] || code;
}

function dispositionColor(code: string): string {
  if (code === "hiring_now") return "bg-green-50 text-green-700 border-green-200";
  if (code === "hiring_later") return "bg-amber-50 text-amber-700 border-amber-200";
  if (code === "no_answer" || code === "wrong_contact") return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-100 text-gray-600";
}

function DiffChip({ field, from, to }: { field: string; from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-[#FFF7F1] border border-[#F0D9C7] rounded px-1.5 py-0.5 mr-1 mb-1 tabular-nums">
      <span className="text-muted-foreground">{field.replace(/_/g, " ")}</span>
      {from && <s className="text-gray-400">{from}</s>}
      <b className="text-[#620124]">{to}</b>
    </span>
  );
}

export function Timeline({
  interactions,
  total,
  page,
  pageSize,
  companyCode,
}: {
  interactions: Interaction[];
  total: number;
  page: number;
  pageSize: number;
  companyCode: string;
}) {
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  function pageHref(p: number) {
    return `/company/${companyCode}?tlPage=${p}`;
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-5">
          <div className="absolute left-[5px] top-1.5 bottom-1.5 w-0.5 bg-border" />

          {interactions.map((entry) => {
            const isEdb = entry.source === "edb" || entry.username === "edb" || entry.username === "backfill";

            let diffs: Record<string, { from: string; to: string }> = {};
            if (entry.fieldsChangedJson) {
              try {
                const parsed = JSON.parse(entry.fieldsChangedJson);
                if (Array.isArray(parsed)) {
                  diffs = Object.assign({}, ...parsed);
                } else {
                  diffs = parsed;
                }
              } catch {
                /* ignore */
              }
            }

            return (
              <div key={entry.id} className="relative pb-5">
                <div
                  className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 bg-white ${
                    isEdb ? "border-blue-500" : "border-[#620124]"
                  }`}
                />

                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <b className="text-foreground">{entry.username}</b>
                  <span>·</span>
                  <span className="capitalize">{entry.team}</span>
                  <span>·</span>
                  <span className="capitalize">{entry.channel}</span>
                  <span>·</span>
                  <span>
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge variant="outline" className={`${dispositionColor(entry.disposition)} text-xs`}>
                    {dispositionLabel(entry.disposition)}
                  </Badge>
                </div>

                <div className="mt-1 text-sm">{entry.comment}</div>

                {Object.keys(diffs).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap">
                    {Object.entries(diffs).map(([field, change]) => (
                      <DiffChip
                        key={field}
                        field={field}
                        from={String(change.from ?? "")}
                        to={String(change.to ?? "")}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-1.5 text-xs text-muted-foreground">
                  Next: <b className="text-foreground font-medium">{entry.nextStep}</b> · {entry.nextActionDate}
                </div>
              </div>
            );
          })}

          {interactions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No interactions yet</p>
          )}
        </div>
      </CardContent>

      {total > pageSize && (
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
    </Card>
  );
}
