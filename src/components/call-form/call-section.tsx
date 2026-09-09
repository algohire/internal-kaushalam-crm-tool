"use client";

import { Label } from "@/components/ui/label";
import {
  dispositions,
  noRequirementReasons,
  channels,
  dispositionRequiresReason,
  dispositionRequiresDate,
} from "@/lib/config/dropdowns";

type Contact = {
  id: string;
  name: string | null;
  designation: string | null;
  mobile: string | null;
  valid: boolean;
};

type Props = {
  contacts: Contact[];
  contactId: string;
  channel: string;
  disposition: string;
  reasonCode: string;
  comment: string;
  onChange: (field: string, value: string) => void;
  errors?: Record<string, string>;
};

export function CallSection({
  contacts,
  contactId,
  channel,
  disposition,
  reasonCode,
  comment,
  onChange,
  errors,
}: Props) {
  const errs = (errors ?? {}) as Record<string, string>;
  const showReason = dispositionRequiresReason(disposition);
  const showDate = dispositionRequiresDate(disposition);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Call</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">
            Contact <span className="text-destructive">*</span>
          </Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={contactId}
            onChange={(e) => onChange("contactId", e.target.value)}
          >
            <option value="">Select contact…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || "Unnamed"} — {c.designation || "N/A"}
                {c.mobile ? ` (${c.mobile})` : ""}
              </option>
            ))}
          </select>
          {errs.contactId && <p className="text-sm text-destructive mt-1">{errs.contactId}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Channel <span className="text-destructive">*</span>
          </Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={channel}
            onChange={(e) => onChange("channel", e.target.value)}
          >
            {channels.map((ch: string) => (
              <option key={ch} value={ch}>
                {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Disposition <span className="text-destructive">*</span>
          </Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={disposition}
            onChange={(e) => onChange("disposition", e.target.value)}
          >
            <option value="">Select…</option>
            {dispositions.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
          {errs.disposition && <p className="text-sm text-destructive mt-1">{errs.disposition}</p>}
        </div>
      </div>

      {showReason && (
        <div className="space-y-1.5 max-w-sm">
          <Label className="text-xs">
            Reason <span className="text-destructive">*</span>
          </Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={reasonCode}
            onChange={(e) => onChange("reasonCode", e.target.value)}
          >
            <option value="">Select reason…</option>
            {noRequirementReasons.map((r: string) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {errs.reasonCode && <p className="text-sm text-destructive mt-1">{errs.reasonCode}</p>}
        </div>
      )}

      {showDate && (
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-xs">
            Follow-up date <span className="text-destructive">*</span>
          </Label>
          <input
            type="date"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={reasonCode}
            onChange={(e) => onChange("reasonCode", e.target.value)}
          />
          {errs.timingDate && <p className="text-sm text-destructive mt-1">{errs.timingDate}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">
          Comment <span className="text-destructive">*</span>
        </Label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          value={comment}
          onChange={(e) => onChange("comment", e.target.value)}
          placeholder="What happened on the call…"
          maxLength={5000}
        />
        {errs.comment && <p className="text-sm text-destructive mt-1">{errs.comment}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">{comment.length}/5000</p>
      </div>
    </div>
  );
}
