"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CallSection } from "@/components/call-form/call-section";
import { RequirementTable } from "@/components/call-form/requirement-table";
import { Classification } from "@/components/call-form/classification";
import { HandoffGate } from "@/components/call-form/handoff-gate";
import { NextStep } from "@/components/call-form/next-step";
import { logCall, type RequirementUpdate } from "@/lib/actions/call";
import { dispositionRequiresReason, dispositionRequiresDate, getDisposition } from "@/lib/config/dropdowns";
import { toast } from "sonner";

type CompanyData = {
  companyCode: string;
  companyName: string;
};

type ContactData = {
  id: string;
  name: string | null;
  designation: string | null;
  mobile: string | null;
  valid: boolean;
};

type RequirementData = {
  id: string;
  roleName: string;
  roleNameEdited: string | null;
  standardRole: string | null;
  requiredCount: number | null;
  requiredCountValidated: number | null;
  qualification: string | null;
  experienceFrom: number | null;
  experienceTo: number | null;
  genderPreference: string | null;
  ageLimit: string | null;
  salary: string | null;
  pwd: boolean | null;
  needTraining: boolean;
  qpCode: string | null;
  classification: string | null;
  collectorDistrict: string | null;
  handoffComment: string | null;
  status: string;
};

type QualificationOption = {
  id: string;
  name: string;
};

type Props = {
  company: CompanyData;
  contacts: ContactData[];
  requirements: RequirementData[];
  qualificationOptions: QualificationOption[];
};

function toRequirementUpdate(req: RequirementData): RequirementUpdate {
  return {
    id: req.id,
    roleName: req.roleName,
    requiredCount: req.requiredCount,
    roleNameEdited: req.roleNameEdited || undefined,
    standardRole: req.standardRole || undefined,
    requiredCountValidated: req.requiredCountValidated,
    qualification: req.qualification || undefined,
    experienceFrom: req.experienceFrom,
    experienceTo: req.experienceTo,
    genderPreference: req.genderPreference || undefined,
    ageLimit: req.ageLimit || undefined,
    salary: req.salary || undefined,
    pwd: req.pwd ?? false,
    needTraining: req.needTraining,
    qpCode: req.qpCode || undefined,
    classification: req.classification || undefined,
    collectorDistrict: req.collectorDistrict || undefined,
    handoffComment: req.handoffComment || undefined,
    status: req.status,
    handoff: false,
  };
}

export function CallFormClient({ company, contacts, requirements, qualificationOptions }: Props) {
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [channel, setChannel] = useState("call");
  const [disposition, setDisposition] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [comment, setComment] = useState("");
  const [timing, setTiming] = useState("now");
  const [timingDate, setTimingDate] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const [reqUpdates, setReqUpdates] = useState<RequirementUpdate[]>(
    requirements.map(toRequirementUpdate)
  );

  function clearError(field: string) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleCallFieldChange(field: string, value: string) {
    clearError(field);
    switch (field) {
      case "contactId": setContactId(value); break;
      case "channel": setChannel(value); break;
      case "disposition": setDisposition(value); break;
      case "reasonCode": setReasonCode(value); break;
      case "comment": setComment(value); break;
      case "timing": setTiming(value); break;
      case "timingDate": setTimingDate(value); break;
    }
  }

  function handleReqUpdate(index: number, field: string, value: unknown) {
    setReqUpdates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handleAddRole() {
    setReqUpdates((prev) => [
      ...prev,
      { id: "", roleName: "", needTraining: false, handoff: false },
    ]);
  }

  function handleRemoveRole(index: number) {
    setReqUpdates((prev) => prev.filter((_, i) => i !== index));
  }

  function handleHandoff(index: number) {
    setReqUpdates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], handoff: true };
      return updated;
    });
  }

  function handleNextStepChange(field: string, value: string) {
    clearError(field);
    if (field === "nextStep") setNextStep(value);
    if (field === "nextActionDate") setNextActionDate(value);
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!contactId) errs.contactId = "Select a contact";
    if (!disposition) errs.disposition = "Select a disposition";
    if (!comment.trim()) errs.comment = "Comment is required";
    if (comment.length > 5000) errs.comment = "Comment too long (max 5000)";
    if (!nextStep.trim()) errs.nextStep = "Next step is required";
    if (nextStep.length > 500) errs.nextStep = "Next step too long (max 500)";

    if (!nextActionDate) {
      errs.nextActionDate = "Next action date is required";
    } else {
      const d = new Date(nextActionDate);
      const today = new Date(new Date().toISOString().split("T")[0]);
      const max = new Date();
      max.setMonth(max.getMonth() + 12);
      if (d < today) errs.nextActionDate = "Cannot be in the past";
      else if (d > max) errs.nextActionDate = "Max 12 months ahead";
    }

    if (dispositionRequiresReason(disposition) && !reasonCode) {
      errs.reasonCode = "Reason required for this disposition";
    }
    if (dispositionRequiresDate(disposition) && !timingDate) {
      errs.timingDate = "Date required for this disposition";
    }

    // Per-requirement validations
    reqUpdates.forEach((req, i) => {
      if (req.experienceFrom != null && req.experienceTo != null && req.experienceTo < req.experienceFrom) {
        errs[`req_${i}_experience`] = `${req.roleNameEdited || req.roleName}: Experience "To" must be ≥ "From"`;
      }
      if (req.salary && (Number(req.salary) < 0 || Number(req.salary) > 9999999)) {
        errs[`req_${i}_salary`] = `${req.roleNameEdited || req.roleName}: Salary must be 0–99,99,999`;
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const isMandatoryMissing =
    !contactId || !disposition || !comment.trim() || !nextStep.trim() || !nextActionDate;

  function handleSaveClick() {
    if (isPending) return;
    if (!validate()) {
      toast.error("Fix the highlighted errors before saving.");
      return;
    }
    setShowConfirm(true);
  }

  function doSave() {
    setShowConfirm(false);
    startTransition(async () => {
      try {
        const result = await logCall({
          companyCode: company.companyCode,
          contactId, channel, disposition,
          reasonCode: reasonCode || undefined,
          comment, timing,
          timingDate: timingDate || undefined,
          nextStep, nextActionDate,
          requirements: reqUpdates,
        });
        if (result && "error" in result) {
          toast.error(result.error);
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "digest" in err && String((err as Record<string, unknown>).digest).startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error("Failed to save call. Please try again.");
      }
    });
  }

  // Build summary for confirmation dialog
  const selectedContact = contacts.find((c) => c.id === contactId);
  const dispLabel = getDisposition(disposition)?.label || disposition;
  const handoffReqs = reqUpdates.filter((r) => r.handoff);
  const changedReqs = reqUpdates.filter((r) => {
    if (!r.id) return true; // new role
    const orig = requirements.find((o) => o.id === r.id);
    if (!orig) return true;
    return (
      r.requiredCountValidated !== orig.requiredCountValidated ||
      r.qualification !== (orig.qualification || undefined) ||
      r.experienceFrom !== orig.experienceFrom ||
      r.experienceTo !== orig.experienceTo ||
      r.classification !== (orig.classification || undefined) ||
      r.pwd !== (orig.pwd ?? false) ||
      r.salary !== (orig.salary || undefined)
    );
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-xs text-muted-foreground">{company.companyCode}</p>
        <h1 className="text-xl font-semibold">Log a call — {company.companyName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fields marked * are mandatory. Handoff unlocks when all gate checks pass.
        </p>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-5">
            <CallSection
              contacts={contacts}
              contactId={contactId}
              channel={channel}
              disposition={disposition}
              reasonCode={reasonCode}
              comment={comment}
              timing={timing}
              timingDate={timingDate}
              onChange={handleCallFieldChange}
              errors={errors}
            />
          </div>

          <div className="bg-card border rounded-lg p-5">
            <RequirementTable
              requirements={reqUpdates}
              qualificationOptions={qualificationOptions}
              onUpdate={handleReqUpdate}
              onAdd={handleAddRole}
              onRemove={handleRemoveRole}
              validationErrors={errors}
            />
          </div>

          <div className="bg-card border rounded-lg p-5">
            <NextStep
              nextStep={nextStep}
              nextActionDate={nextActionDate}
              onChange={handleNextStepChange}
              errors={errors}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-5">
            <Classification
              requirements={reqUpdates}
              onUpdate={handleReqUpdate}
            />
          </div>

          <div className="bg-card border rounded-lg p-5">
            <HandoffGate
              requirements={reqUpdates}
              contacts={contacts}
              onHandoff={handleHandoff}
            />
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
              <p className="text-xs font-medium text-red-700">Fix these errors:</p>
              {Object.values(errors).map((e, i) => (
                <p key={i} className="text-xs text-red-600">• {e}</p>
              ))}
            </div>
          )}

          {isMandatoryMissing && Object.keys(errors).length === 0 && !isPending && (
            <p className="text-xs text-muted-foreground">
              Fill contact, disposition, comment, next step, and next action date to save.
            </p>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-8 z-50 flex items-center gap-3 bg-card border shadow-lg rounded-full px-4 py-2.5">
        {isMandatoryMissing && (
          <span className="text-xs text-muted-foreground max-w-[200px]">
            Fill all mandatory fields
          </span>
        )}
        {Object.keys(errors).length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? "s" : ""}
          </Badge>
        )}
        <Button
          onClick={handleSaveClick}
          disabled={isPending}
          className="bg-[#620124] hover:bg-[#7B1A36] rounded-full px-6"
          size="lg"
        >
          {isPending ? "Saving…" : "Save Call"}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm call save</DialogTitle>
            <DialogDescription>
              Review the summary before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Contact:</span>{" "}
                <span className="font-medium">{selectedContact?.name || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Channel:</span>{" "}
                <span className="font-medium capitalize">{channel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Disposition:</span>{" "}
                <Badge variant="outline" className="text-xs ml-1">{dispLabel}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Next action:</span>{" "}
                <span className="font-medium">{nextActionDate}</span>
              </div>
            </div>

            <div>
              <span className="text-muted-foreground">Comment:</span>
              <p className="mt-0.5 bg-muted/50 rounded px-2 py-1.5 text-xs">{comment}</p>
            </div>

            <div>
              <span className="text-muted-foreground">Next step:</span>
              <p className="mt-0.5 font-medium">{nextStep}</p>
            </div>

            {changedReqs.length > 0 && (
              <div>
                <span className="text-muted-foreground">Requirements updated ({changedReqs.length}):</span>
                <ul className="mt-1 space-y-1">
                  {changedReqs.map((r, i) => (
                    <li key={i} className="text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D9601F]" />
                      {r.roleNameEdited || r.roleName || "New role"}
                      {r.requiredCountValidated != null && (
                        <span className="text-muted-foreground">— {r.requiredCountValidated} openings</span>
                      )}
                      {r.classification && (
                        <Badge variant="outline" className="text-[10px]">{r.classification}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {handoffReqs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5">
                <span className="text-amber-800 font-medium text-xs">
                  Handing off {handoffReqs.length} role{handoffReqs.length > 1 ? "s" : ""}:
                </span>
                <ul className="mt-1 space-y-0.5">
                  {handoffReqs.map((r, i) => (
                    <li key={i} className="text-xs text-amber-700">
                      • {r.roleNameEdited || r.roleName} → {r.classification}
                      {r.collectorDistrict && ` (${r.collectorDistrict})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Go back
            </Button>
            <Button
              onClick={doSave}
              disabled={isPending}
              className="bg-[#620124] hover:bg-[#7B1A36]"
            >
              {isPending ? "Saving…" : "Confirm & Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
