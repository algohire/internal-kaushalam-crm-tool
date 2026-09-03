"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { RequirementUpdate } from "@/lib/actions/call";
import { QualificationMultiSelect, type QualificationOption } from "./qualification-multi-select";
import { Plus, X } from "lucide-react";

type Props = {
  requirements: RequirementUpdate[];
  qualificationOptions: QualificationOption[];
  onUpdate: (index: number, field: string, value: unknown) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  validationErrors?: Record<string, string>;
};

function reqField(className: string, isEmpty: boolean, isRequired: boolean) {
  if (isRequired && isEmpty) {
    return `${className} border-red-400 bg-red-50/50 ring-1 ring-red-200`;
  }
  return className;
}

export function RequirementTable({
  requirements,
  qualificationOptions,
  onUpdate,
  onAdd,
  onRemove,
  validationErrors = {},
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

      {requirements.map((req, idx) => {
        const roleName = req.roleNameEdited || req.roleName;
        const baseInput =
          "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";

        return (
          <div
            key={req.id || `new-${idx}`}
            className="border rounded-md p-4 space-y-3 relative"
          >
            {!req.id && (
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">New</Badge>
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
                {req.requiredCount != null && (
                  <span className="ml-2 font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {req.requiredCount} openings on EDB
                  </span>
                )}
              </div>
            )}

            {/* Row 1: Role, Standard Role, Validated Count, Qualification */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Role title <span className="text-destructive">*</span>
                </Label>
                <input
                  type="text"
                  className={reqField(
                    `${baseInput} ${req.id ? "bg-blue-50 border-blue-200" : ""}`,
                    !roleName,
                    true
                  )}
                  value={roleName}
                  onChange={(e) => onUpdate(idx, "roleNameEdited", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Standard role</Label>
                <input
                  type="text"
                  className={baseInput}
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
                  className={reqField(
                    baseInput,
                    req.requiredCountValidated == null,
                    true
                  )}
                  value={req.requiredCountValidated ?? ""}
                  onChange={(e) =>
                    onUpdate(idx, "requiredCountValidated", e.target.value ? Number(e.target.value) : null)
                  }
                  min={0}
                  max={99999}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Qualification <span className="text-destructive">*</span>
                </Label>
                <QualificationMultiSelect
                  options={qualificationOptions}
                  selected={req.qualification ? req.qualification.split(";").filter(Boolean) : []}
                  onChange={(ids) => onUpdate(idx, "qualification", ids.join(";"))}
                  required
                  hasError={!req.qualification}
                />
              </div>
            </div>

            {/* Row 2: Experience From/To, Gender, Age Limit */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Experience from (yrs) <span className="text-destructive">*</span>
                </Label>
                <input
                  type="number"
                  className={reqField(
                    baseInput,
                    req.experienceFrom == null,
                    true
                  )}
                  value={req.experienceFrom ?? ""}
                  onChange={(e) =>
                    onUpdate(idx, "experienceFrom", e.target.value ? Number(e.target.value) : null)
                  }
                  min={0}
                  max={15}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Experience to (yrs) <span className="text-destructive">*</span>
                </Label>
                <input
                  type="number"
                  className={reqField(
                    baseInput,
                    req.experienceTo == null,
                    true
                  )}
                  value={req.experienceTo ?? ""}
                  onChange={(e) =>
                    onUpdate(idx, "experienceTo", e.target.value ? Number(e.target.value) : null)
                  }
                  min={0}
                  max={15}
                  placeholder="15"
                />
                {req.experienceFrom != null && req.experienceTo != null && req.experienceTo < req.experienceFrom && (
                  <p className="text-xs text-destructive">&quot;To&quot; must be ≥ &quot;From&quot;</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
                <select
                  className={baseInput}
                  value={req.genderPreference || ""}
                  onChange={(e) => onUpdate(idx, "genderPreference", e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Age limit</Label>
                <input
                  type="text"
                  className={baseInput}
                  value={req.ageLimit || ""}
                  onChange={(e) => onUpdate(idx, "ageLimit", e.target.value)}
                  placeholder="e.g. 18–35"
                />
              </div>
            </div>

            {/* Row 3: Salary, PWD */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Salary (₹/month)</Label>
                <input
                  type="number"
                  className={baseInput}
                  value={req.salary || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || (Number(v) >= 0 && Number(v) <= 9999999)) {
                      onUpdate(idx, "salary", v);
                    }
                  }}
                  min={0}
                  max={9999999}
                  placeholder="e.g. 12500"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">PWD — Diversity Hiring</Label>
                <select
                  className={baseInput}
                  value={req.pwd ? "yes" : "no"}
                  onChange={(e) => onUpdate(idx, "pwd", e.target.value === "yes")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={req.status === "no_requirement"}
                  onChange={(e) =>
                    onUpdate(idx, "status", e.target.checked ? "no_requirement" : "captured")
                  }
                />
                Not required any more
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
