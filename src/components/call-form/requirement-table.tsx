"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RequirementUpdate } from "@/lib/actions/call";
import { QualificationMultiSelect, type QualificationOption } from "./qualification-multi-select";
import { Plus, X, Copy } from "lucide-react";

type Props = {
  requirements: RequirementUpdate[];
  qualificationOptions: QualificationOption[];
  onUpdate: (index: number, field: string, value: unknown) => void;
  onApplyToAll: (field: string, value: unknown) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function hasAnyValue(req: RequirementUpdate): boolean {
  return !!(
    req.requiredCountValidated != null ||
    req.qualification ||
    req.experienceFrom != null ||
    req.experienceTo != null ||
    req.genderPreference ||
    req.ageLimit ||
    req.salary ||
    req.classification
  );
}

function ApplyAllButton({
  field,
  label,
  value,
  onApply,
}: {
  field: string;
  label: string;
  value: unknown;
  onApply: (field: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasValue = value !== null && value !== undefined && value !== "" && value !== false;

  if (!hasValue) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#620124] transition-colors mt-0.5"
        title={`Apply "${label}" to all roles`}
      >
        <Copy className="w-3 h-3" />
        Apply to all
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply to all roles?</DialogTitle>
            <DialogDescription>
              This will set <strong>{label}</strong> to the same value for every role on this page.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}:</span>{" "}
            <strong>{String(value)}</strong>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-[#620124] hover:bg-[#7B1A36]"
              onClick={() => { onApply(field, value); setOpen(false); }}
            >
              Apply to all roles
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RequirementTable({
  requirements,
  qualificationOptions,
  onUpdate,
  onApplyToAll,
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

      {requirements.map((req, idx) => {
        const roleName = req.roleNameEdited || req.roleName;
        const baseInput =
          "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";
        const isTouched = hasAnyValue(req);

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

            {/* Row 1: Role, Validated Count, Qualification */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  Role title <span className="text-destructive">*</span>
                </Label>
                <input
                  type="text"
                  className={`${baseInput} ${req.id ? "bg-blue-50 border-blue-200" : ""}`}
                  value={roleName}
                  onChange={(e) => onUpdate(idx, "roleNameEdited", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Validated count
                </Label>
                <input
                  type="number"
                  className={baseInput}
                  value={req.requiredCountValidated ?? 0}
                  onChange={(e) =>
                    onUpdate(idx, "requiredCountValidated", e.target.value ? Number(e.target.value) : 0)
                  }
                  min={0}
                  max={99999}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Qualification</Label>
                <QualificationMultiSelect
                  options={qualificationOptions}
                  selected={req.qualification ? req.qualification.split(";").filter(Boolean) : []}
                  onChange={(ids) => onUpdate(idx, "qualification", ids.join(";"))}
                  required={false}
                  hasError={false}
                />
                <ApplyAllButton
                  field="qualification"
                  label="Qualification"
                  value={req.qualification}
                  onApply={onApplyToAll}
                />
              </div>
            </div>

            {/* Row 2: Experience From/To, Gender, Age Limit */}
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Experience from (yrs)</Label>
                <input
                  type="number"
                  className={`${baseInput} ${isTouched && req.experienceFrom != null && req.experienceTo != null && req.experienceTo < req.experienceFrom ? "border-red-400 bg-red-50/50 ring-1 ring-red-200" : ""}`}
                  value={req.experienceFrom ?? ""}
                  onChange={(e) =>
                    onUpdate(idx, "experienceFrom", e.target.value ? Number(e.target.value) : null)
                  }
                  min={0}
                  max={15}
                  placeholder="0"
                />
                <ApplyAllButton
                  field="experienceFrom"
                  label="Experience from"
                  value={req.experienceFrom}
                  onApply={onApplyToAll}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Experience to (yrs)</Label>
                <input
                  type="number"
                  className={`${baseInput} ${isTouched && req.experienceFrom != null && req.experienceTo != null && req.experienceTo < req.experienceFrom ? "border-red-400 bg-red-50/50 ring-1 ring-red-200" : ""}`}
                  value={req.experienceTo ?? ""}
                  onChange={(e) =>
                    onUpdate(idx, "experienceTo", e.target.value ? Number(e.target.value) : null)
                  }
                  min={0}
                  max={15}
                  placeholder="15"
                />
                {isTouched && req.experienceFrom != null && req.experienceTo != null && req.experienceTo < req.experienceFrom && (
                  <p className="text-xs text-destructive">&quot;To&quot; must be ≥ &quot;From&quot;</p>
                )}
                <ApplyAllButton
                  field="experienceTo"
                  label="Experience to"
                  value={req.experienceTo}
                  onApply={onApplyToAll}
                />
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
                <ApplyAllButton
                  field="genderPreference"
                  label="Gender"
                  value={req.genderPreference}
                  onApply={onApplyToAll}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Age limit</Label>
                <input
                  type="number"
                  className={baseInput}
                  value={req.ageLimit || ""}
                  onChange={(e) => onUpdate(idx, "ageLimit", e.target.value)}
                  placeholder="e.g. 35"
                  min={18}
                  max={65}
                />
                <ApplyAllButton
                  field="ageLimit"
                  label="Age limit"
                  value={req.ageLimit}
                  onApply={onApplyToAll}
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
                <ApplyAllButton
                  field="salary"
                  label="Salary"
                  value={req.salary}
                  onApply={onApplyToAll}
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
                <ApplyAllButton
                  field="pwd"
                  label="PWD"
                  value={req.pwd}
                  onApply={onApplyToAll}
                />
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
