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
import { dispositionRequiresReason, dispositionRequiresDate, getDisposition, isConnectedDisposition } from "@/lib/config/dropdowns";
import { toast } from "sonner";
import { AlertTriangle, Phone, ClipboardCheck } from "lucide-react";

type CompanyData = { companyCode: string; companyName: string };
type ContactData = { id: string; name: string | null; designation: string | null; mobile: string | null; valid: boolean };
type QualificationOption = { id: string; name: string };
type RequirementData = {
  id: string; roleName: string; roleNameEdited: string | null;
  requiredCount: number | null; requiredCountValidated: number | null;
  qualification: string | null; experienceFrom: number | null; experienceTo: number | null;
  genderPreference: string | null; ageLimit: string | null; salary: string | null;
  pwd: boolean | null; needTraining: boolean; qpCode: string | null;
  classification: string | null; collectorDistrict: string | null;
  handoffComment: string | null; status: string;
};

type Props = {
  company: CompanyData;
  contacts: ContactData[];
  requirements: RequirementData[];
  qualificationOptions: QualificationOption[];
};

function toReqUpdate(req: RequirementData): RequirementUpdate {
  return {
    id: req.id, roleName: req.roleName, requiredCount: req.requiredCount,
    roleNameEdited: req.roleNameEdited || undefined,
    requiredCountValidated: req.requiredCountValidated ?? 0,
    qualification: req.qualification || undefined,
    experienceFrom: req.experienceFrom, experienceTo: req.experienceTo,
    genderPreference: req.genderPreference || undefined,
    ageLimit: req.ageLimit || undefined, salary: req.salary || undefined,
    pwd: req.pwd ?? false, needTraining: req.needTraining,
    qpCode: req.qpCode || undefined, classification: req.classification || undefined,
    collectorDistrict: req.collectorDistrict || undefined,
    handoffComment: req.handoffComment || undefined,
    status: req.status, handoff: false,
  };
}

function isRoleValidated(req: RequirementUpdate): boolean {
  return (
    (req.requiredCountValidated ?? 0) > 0 &&
    !!req.qualification &&
    req.experienceFrom != null &&
    req.experienceTo != null
  );
}

export function CallFormClient({ company, contacts, requirements, qualificationOptions }: Props) {
  const [isPending, startTransition] = useTransition();

  const [contactId, setContactId] = useState("");
  const [channel, setChannel] = useState("call");
  const [disposition, setDisposition] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [comment, setComment] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveMode, setSaveMode] = useState<"call-only" | "validate">("call-only");

  const [reqUpdates, setReqUpdates] = useState<RequirementUpdate[]>(
    requirements.map(toReqUpdate)
  );

  function clearError(field: string) {
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }

  function handleCallFieldChange(field: string, value: string) {
    clearError(field);
    switch (field) {
      case "contactId": setContactId(value); break;
      case "channel": setChannel(value); break;
      case "disposition": setDisposition(value); break;
      case "reasonCode": setReasonCode(value); break;
      case "comment": setComment(value); break;
    }
  }

  function handleReqUpdate(index: number, field: string, value: unknown) {
    setReqUpdates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handleApplyToAll(field: string, value: unknown) {
    setReqUpdates((prev) =>
      prev.map((req) => (req.status === "no_requirement" ? req : { ...req, [field]: value }))
    );
  }

  function handleAddRole() {
    setReqUpdates((prev) => [...prev, { id: "", roleName: "", needTraining: false, handoff: false }]);
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

  // Validation for call-level fields (shared by both save modes)
  function validateCallFields(): Record<string, string> {
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
      const max = new Date(); max.setMonth(max.getMonth() + 12);
      if (d < today) errs.nextActionDate = "Cannot be in the past";
      else if (d > max) errs.nextActionDate = "Max 12 months ahead";
    }
    if (dispositionRequiresReason(disposition) && !reasonCode) {
      errs.reasonCode = "Reason required for this disposition";
    }
    return errs;
  }

  // Counts
  const activeRoles = reqUpdates.filter((r) => r.status !== "no_requirement");
  const validatedRoles = activeRoles.filter(isRoleValidated);
  const pendingRoles = activeRoles.length - validatedRoles.length;
  const isConnected = isConnectedDisposition(disposition);
  const hasAnyValidated = validatedRoles.length > 0;

  const callFieldsMissing = !contactId || !disposition || !comment.trim() || !nextStep.trim() || !nextActionDate;

  // "Save call only" click
  function handleSaveCallOnly() {
    if (isPending) return;
    const errs = validateCallFields();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Fix the highlighted errors.");
      return;
    }
    setSaveMode("call-only");
    setShowConfirm(true);
  }

  // "Save & validate roles" click
  function handleSaveAndValidate() {
    if (isPending) return;
    const errs = validateCallFields();

    // Enforce (A): if connected disposition, at least one role must be validated
    if (isConnected && !hasAnyValidated) {
      errs.roles = "You selected a connected disposition — validate at least one role (count > 0, qualification, experience).";
    }

    // Per-role validations
    reqUpdates.forEach((req, i) => {
      if (req.status === "no_requirement") return;
      if (req.experienceFrom != null && req.experienceTo != null && req.experienceTo < req.experienceFrom) {
        errs[`req_${i}_experience`] = `${req.roleNameEdited || req.roleName}: Experience "To" must be ≥ "From"`;
      }
      if (req.salary && (Number(req.salary) < 0 || Number(req.salary) > 9999999)) {
        errs[`req_${i}_salary`] = `${req.roleNameEdited || req.roleName}: Salary must be 0–99,99,999`;
      }
    });

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error("Fix the highlighted errors.");
      return;
    }
    setSaveMode("validate");
    setShowConfirm(true);
  }

  function doSave() {
    setShowConfirm(false);
    startTransition(async () => {
      try {
        // For "call-only", pass requirements but without any updates (keep originals)
        const reqs = saveMode === "call-only"
          ? reqUpdates.map((r) => ({ ...r, handoff: false }))
          : reqUpdates;

        const result = await logCall({
          companyCode: company.companyCode,
          contactId, channel, disposition,
          reasonCode: reasonCode || undefined,
          comment,
          nextStep, nextActionDate,
          requirements: saveMode === "call-only" ? [] : reqs,
          callOnly: saveMode === "call-only",
        });
        if (result && "error" in result) {
          toast.error(result.error);
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "digest" in err && String((err as Record<string, unknown>).digest).startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error("Failed to save call.");
      }
    });
  }

  // Summary data
  const selectedContact = contacts.find((c) => c.id === contactId);
  const dispLabel = getDisposition(disposition)?.label || disposition;
  const handoffReqs = reqUpdates.filter((r) => r.handoff);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">{company.companyCode}</p>
        <h1 className="text-xl font-semibold">Log a call — {company.companyName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Log the call first, then validate roles if you have the details.
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
              onChange={handleCallFieldChange}
              errors={errors}
            />
          </div>

          <div className="bg-card border rounded-lg p-5">
            <RequirementTable
              requirements={reqUpdates}
              qualificationOptions={qualificationOptions}
              onUpdate={handleReqUpdate}
              onApplyToAll={handleApplyToAll}
              onAdd={handleAddRole}
              onRemove={handleRemoveRole}
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

          {/* (C) Warning: pending roles */}
          {pendingRoles > 0 && hasAnyValidated && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                <strong>{pendingRoles} of {activeRoles.length} roles</strong> have no validated count — they won't appear in validation reports.
              </p>
            </div>
          )}

          {isConnected && !hasAnyValidated && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800">
                Connected disposition selected but no roles validated. Use &quot;Save &amp; Validate Roles&quot; to validate at least one role, or &quot;Save Call Only&quot; if you don&apos;t have role details yet.
              </p>
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 space-y-1">
              <p className="text-xs font-medium text-red-700">Fix these errors:</p>
              {Object.values(errors).map((e, i) => (
                <p key={i} className="text-xs text-red-600">• {e}</p>
              ))}
            </div>
          )}

          {callFieldsMissing && Object.keys(errors).length === 0 && !isPending && (
            <p className="text-xs text-muted-foreground">
              Fill contact, disposition, comment, next step, and next action date to save.
            </p>
          )}
        </div>
      </div>

      {/* (B) Floating save bar with two buttons */}
      <div className="fixed bottom-6 right-8 z-50 flex items-center gap-3 bg-card border shadow-lg rounded-full px-5 py-3">
        {pendingRoles > 0 && (
          <span className="text-xs text-amber-600 font-medium">
            {pendingRoles} role{pendingRoles > 1 ? "s" : ""} pending
          </span>
        )}

        <Button
          variant="outline"
          onClick={handleSaveCallOnly}
          disabled={isPending || callFieldsMissing}
          className="rounded-full gap-1.5"
        >
          <Phone className="w-4 h-4" />
          {isPending && saveMode === "call-only" ? "Saving…" : "Save Call Only"}
        </Button>

        <Button
          onClick={handleSaveAndValidate}
          disabled={isPending || callFieldsMissing}
          className="bg-[#620124] hover:bg-[#7B1A36] rounded-full gap-1.5 px-5"
        >
          <ClipboardCheck className="w-4 h-4" />
          {isPending && saveMode === "validate" ? "Saving…" : "Save & Validate Roles"}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {saveMode === "call-only" ? "Save call only?" : "Save & validate roles?"}
            </DialogTitle>
            <DialogDescription>
              {saveMode === "call-only"
                ? "This logs the call without updating any role data. Roles stay as-is."
                : "This logs the call and updates all role requirement data."}
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

            {saveMode === "validate" && (
              <>
                <Separator />
                <div className="flex gap-4 text-xs">
                  <span className="text-green-700 font-medium">{validatedRoles.length} roles validated</span>
                  {pendingRoles > 0 && (
                    <span className="text-amber-600 font-medium">{pendingRoles} roles still pending</span>
                  )}
                </div>

                {pendingRoles > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5">
                    <p className="text-xs text-amber-800">
                      <strong>{pendingRoles} role{pendingRoles > 1 ? "s" : ""}</strong> have incomplete validation.
                      They won't count in reporting until validated in a future call.
                    </p>
                  </div>
                )}

                {handoffReqs.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-2.5">
                    <span className="text-green-800 font-medium text-xs">
                      Handing off {handoffReqs.length} role{handoffReqs.length > 1 ? "s" : ""}:
                    </span>
                    <ul className="mt-1 space-y-0.5">
                      {handoffReqs.map((r, i) => (
                        <li key={i} className="text-xs text-green-700">
                          • {r.roleNameEdited || r.roleName} → {r.classification}
                          {r.collectorDistrict && ` (${r.collectorDistrict})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {saveMode === "call-only" && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5">
                <p className="text-xs text-blue-800">
                  Role data will not be updated. You can validate roles in a follow-up call.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Go back</Button>
            <Button
              onClick={doSave}
              disabled={isPending}
              className={saveMode === "call-only" ? "" : "bg-[#620124] hover:bg-[#7B1A36]"}
              variant={saveMode === "call-only" ? "outline" : "default"}
            >
              {isPending ? "Saving…" : saveMode === "call-only" ? "Confirm — Call Only" : "Confirm & Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
