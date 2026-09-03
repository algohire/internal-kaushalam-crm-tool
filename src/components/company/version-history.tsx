"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

type Version = {
  id: string;
  requirementId: string;
  version: number;
  changedAt: string;
  changedBy: string;
  diffJson: string;
  snapshotJson: string;
};

type Props = {
  versions: Version[];
  requirementNames: Record<string, string>;
};

function DiffChip({ field, from, to }: { field: string; from: string; to: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-[#FFF7F1] border border-[#F0D9C7] rounded px-1.5 py-0.5 mr-1 mb-1 tabular-nums">
      <span className="text-muted-foreground">{field.replace(/_/g, " ")}</span>
      {from && <s className="text-gray-400">{from}</s>}
      <b className="text-[#620124]">{to}</b>
    </span>
  );
}

export function VersionHistory({ versions, requirementNames }: Props) {
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());

  const grouped = versions.reduce<Record<string, Version[]>>((acc, v) => {
    if (!acc[v.requirementId]) acc[v.requirementId] = [];
    acc[v.requirementId].push(v);
    return acc;
  }, {});

  for (const reqId of Object.keys(grouped)) {
    grouped[reqId].sort((a, b) => b.version - a.version);
  }

  function toggle(reqId: string) {
    setExpandedReqs((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  }

  if (versions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Version History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(grouped).map(([reqId, reqVersions]) => {
          const isOpen = expandedReqs.has(reqId);
          const roleName = requirementNames[reqId] || reqId;

          return (
            <div key={reqId}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-left h-auto py-1.5 px-2"
                onClick={() => toggle(reqId)}
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 mr-1 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1 flex-shrink-0" />
                )}
                <span className="font-medium text-sm">{roleName}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {reqVersions.length} version{reqVersions.length !== 1 ? "s" : ""}
                </span>
              </Button>

              {isOpen && (
                <div className="pl-7 space-y-2 mt-1">
                  {reqVersions.map((v) => {
                    let diffs: Record<string, { from: string; to: string }> = {};
                    try {
                      diffs = JSON.parse(v.diffJson);
                    } catch {
                      /* ignore */
                    }

                    const isEdb = v.changedBy === "edb" || v.changedBy === "backfill";

                    return (
                      <div key={v.id} className="text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">v{v.version}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">
                            {new Date(v.changedAt).toLocaleDateString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          {isEdb ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            >
                              {v.changedBy.toUpperCase()}
                            </Badge>
                          ) : (
                            <span>{v.changedBy}</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap">
                          {Object.entries(diffs).map(([field, change]) => (
                            <DiffChip
                              key={field}
                              field={field}
                              from={String(change.from ?? "")}
                              to={String(change.to ?? "")}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
