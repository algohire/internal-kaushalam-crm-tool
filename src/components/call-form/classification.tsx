"use client";

import { Label } from "@/components/ui/label";
import { classifications } from "@/lib/config/dropdowns";
import { districts } from "@/lib/config/districts";
import type { RequirementUpdate } from "@/lib/actions/call";

type Props = {
  requirements: RequirementUpdate[];
  onUpdate: (index: number, field: string, value: unknown) => void;
};

export function Classification({ requirements, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Classification and handoff</h3>

      {requirements.map((req, idx) => {
        if (req.status === "no_requirement") return null;
        const roleName = req.roleNameEdited || req.roleName;

        return (
          <div key={req.id || `cls-${idx}`} className="border rounded-md p-4 space-y-3">
            <div className="text-sm font-medium">{roleName}</div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Classification <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-col gap-2">
                {classifications.map((cls) => (
                  <label key={cls.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`classification-${idx}`}
                      value={cls.code}
                      checked={req.classification === cls.code}
                      onChange={(e) =>
                        onUpdate(idx, "classification", e.target.value)
                      }
                    />
                    {cls.label}
                  </label>
                ))}
              </div>
            </div>

            {req.classification === "collector" && (
              <div className="space-y-1.5 max-w-sm">
                <Label className="text-xs">
                  District for Collector ticket{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  value={req.collectorDistrict || ""}
                  onChange={(e) =>
                    onUpdate(idx, "collectorDistrict", e.target.value)
                  }
                >
                  <option value="">Select district…</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {req.classification === "apssdc" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={req.needTraining}
                    onChange={(e) =>
                      onUpdate(idx, "needTraining", e.target.checked)
                    }
                  />
                  Flag for APSSDC training{" "}
                  <span className="text-destructive">*</span>
                </label>
                <div className="space-y-1 max-w-xs">
                  <Label className="text-xs">QP code (optional)</Label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                    value={req.qpCode || ""}
                    onChange={(e) => onUpdate(idx, "qpCode", e.target.value)}
                    placeholder="e.g. FIC/Q0101"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">
                Handoff comment{" "}
                <span className="text-destructive">*</span>
              </Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm min-h-[60px] resize-y"
                value={req.handoffComment || ""}
                onChange={(e) =>
                  onUpdate(idx, "handoffComment", e.target.value)
                }
                placeholder="Context for the receiving team…"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
