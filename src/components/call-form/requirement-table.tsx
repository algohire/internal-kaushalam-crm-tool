"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  qualifications,
  experiences,
  genderPreferences,
} from "@/lib/config/dropdowns";
import type { RequirementUpdate } from "@/lib/actions/call";
import { Plus, X } from "lucide-react";

type Props = {
  requirements: RequirementUpdate[];
  onUpdate: (index: number, field: string, value: unknown) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export function RequirementTable({
  requirements,
  onUpdate,
  onAdd,
  onRemove,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Requirement, per role</h3>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add role
        </Button>
      </div>

      {requirements.map((req, idx) => (
        <div
          key={req.id || `new-${idx}`}
          className="border rounded-md p-4 space-y-3 relative"
        >
          {!req.id && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                New
              </Badge>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {req.id && (
            <div className="text-xs text-muted-foreground mb-1">
              EDB: {req.roleName}
              {req.requiredCountValidated != null && (
                <> · {req.requiredCountValidated} openings</>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Role title <span className="text-destructive">*</span>
              </Label>
              <input
                type="text"
                className={`w-full rounded-md border border-input px-2.5 py-1.5 text-sm ${
                  req.id ? "bg-blue-50 border-blue-200" : "bg-background"
                }`}
                value={req.roleNameEdited || req.roleName}
                onChange={(e) =>
                  onUpdate(idx, "roleNameEdited", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Standard role</Label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.standardRole || ""}
                onChange={(e) => onUpdate(idx, "standardRole", e.target.value)}
                placeholder="Type-ahead…"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Validated count <span className="text-destructive">*</span>
              </Label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.requiredCountValidated ?? ""}
                onChange={(e) =>
                  onUpdate(
                    idx,
                    "requiredCountValidated",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                min={0}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Qualification <span className="text-destructive">*</span>
              </Label>
              <select
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.qualification || ""}
                onChange={(e) => onUpdate(idx, "qualification", e.target.value)}
              >
                <option value="">Select…</option>
                {qualifications.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Experience <span className="text-destructive">*</span>
              </Label>
              <select
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.experience || ""}
                onChange={(e) => onUpdate(idx, "experience", e.target.value)}
              >
                <option value="">Select…</option>
                {experiences.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Gender</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.genderPreference || ""}
                onChange={(e) =>
                  onUpdate(idx, "genderPreference", e.target.value)
                }
              >
                <option value="">Any</option>
                {genderPreferences.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Age limit</Label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.ageLimit || ""}
                onChange={(e) => onUpdate(idx, "ageLimit", e.target.value)}
                placeholder="e.g. 18–35"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Salary</Label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.salary || ""}
                onChange={(e) => onUpdate(idx, "salary", e.target.value)}
                placeholder="₹"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Shift</Label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.shift || ""}
                onChange={(e) => onUpdate(idx, "shift", e.target.value)}
                placeholder="Day / Night / Rotational"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Monthly intake</Label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.monthlyIntake ?? ""}
                onChange={(e) =>
                  onUpdate(
                    idx,
                    "monthlyIntake",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                min={0}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Comment</Label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                value={req.comment || ""}
                onChange={(e) => onUpdate(idx, "comment", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={req.status === "no_requirement"}
                onChange={(e) =>
                  onUpdate(
                    idx,
                    "status",
                    e.target.checked ? "no_requirement" : "captured"
                  )
                }
              />
              Not required any more
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
