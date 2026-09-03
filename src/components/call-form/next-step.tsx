"use client";

import { Label } from "@/components/ui/label";

type Props = {
  nextStep: string;
  nextActionDate: string;
  onChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
};

export function NextStep({ nextStep, nextActionDate, onChange, errors = {} }: Props) {
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 12);
  const maxDateStr = maxDate.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">Next step</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">
            Next step <span className="text-destructive">*</span>
          </Label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={nextStep}
            onChange={(e) => onChange("nextStep", e.target.value)}
            placeholder="What to do next for this company…"
            maxLength={500}
          />
          {errors.nextStep && <p className="text-sm text-destructive mt-1">{errors.nextStep}</p>}
          <p className="text-xs text-muted-foreground">{nextStep.length}/500</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Next action date <span className="text-destructive">*</span>
          </Label>
          <input
            type="date"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={nextActionDate}
            onChange={(e) => onChange("nextActionDate", e.target.value)}
            min={todayStr}
            max={maxDateStr}
          />
          {errors.nextActionDate && <p className="text-sm text-destructive mt-1">{errors.nextActionDate}</p>}
          <span className="text-[11px] text-muted-foreground">
            Up to 12 months ahead
          </span>
        </div>
      </div>
    </div>
  );
}
