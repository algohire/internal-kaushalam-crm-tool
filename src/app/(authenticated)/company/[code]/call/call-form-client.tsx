"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CallSection } from "@/components/call-form/call-section";
import { RequirementTable } from "@/components/call-form/requirement-table";
import { Classification } from "@/components/call-form/classification";
import { HandoffGate } from "@/components/call-form/handoff-gate";
import { NextStep } from "@/components/call-form/next-step";
import { logCall, type RequirementUpdate } from "@/lib/actions/call";
import { callSchema, flattenZodErrors } from "@/lib/validations";
import { dispositionRequiresReason, dispositionRequiresDate } from "@/lib/config/dropdowns";
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
  experience: string | null;
  genderPreference: string | null;
  ageLimit: string | null;
  salary: string | null;
  shift: string | null;
  monthlyIntake: number | null;
  needTraining: boolean;
  qpCode: string | null;
  classification: string | null;
  collectorDistrict: string | null;
  handoffComment: string | null;
  comment: string | null;
  status: string;
};

type Props = {
  company: CompanyData;
  contacts: ContactData[];
  requirements: RequirementData[];
};

function toRequirementUpdate(req: RequirementData): RequirementUpdate {
  return {
    id: req.id,
    roleName: req.roleName,
    roleNameEdited: req.roleNameEdited || undefined,
    standardRole: req.standardRole || undefined,
    requiredCountValidated: req.requiredCountValidated,
    qualification: req.qualification || undefined,
    experience: req.experience || undefined,
    genderPreference: req.genderPreference || undefined,
    ageLimit: req.ageLimit || undefined,
    salary: req.salary || undefined,
    shift: req.shift || undefined,
    monthlyIntake: req.monthlyIntake,
    needTraining: req.needTraining,
    qpCode: req.qpCode || undefined,
    classification: req.classification || undefined,
    collectorDistrict: req.collectorDistrict || undefined,
    handoffComment: req.handoffComment || undefined,
    comment: req.comment || undefined,
    status: req.status,
    handoff: false,
  };
}

export function CallFormClient({ company, contacts, requirements }: Props) {
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
    if (comment.length > 5000) errs.comment = "Comment too long (max 5000 chars)";
    if (!nextStep.trim()) errs.nextStep = "Next step is required";
    if (nextStep.length > 500) errs.nextStep = "Next step too long (max 500 chars)";

    if (!nextActionDate) {
      errs.nextActionDate = "Next action date is required";
    } else {
      const d = new Date(nextActionDate);
      const today = new Date(new Date().toISOString().split("T")[0]);
      const max = new Date();
      max.setMonth(max.getMonth() + 12);
      if (d < today) errs.nextActionDate = "Date cannot be in the past";
      else if (d > max) errs.nextActionDate = "Date cannot be more than 12 months ahead";
    }

    if (dispositionRequiresReason(disposition) && !reasonCode) {
      errs.reasonCode = "Reason is required for this disposition";
    }
    if (dispositionRequiresDate(disposition) && !timingDate) {
      errs.timingDate = "Date is required for this disposition";
    }

    // Also run zod for deeper validation
    const formData = {
      companyCode: company.companyCode,
      contactId, channel, disposition,
      reasonCode: reasonCode || undefined,
      comment, timing,
      timingDate: timingDate || undefined,
      nextStep, nextActionDate,
      requirements: reqUpdates,
    };
    const parsed = callSchema.safeParse(formData);
    if (!parsed.success) {
      const zodErrs = flattenZodErrors(parsed.error);
      Object.assign(errs, zodErrs);
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const isMandatoryMissing =
    !contactId || !disposition || !comment.trim() || !nextStep.trim() || !nextActionDate;

  function handleSave() {
    if (isPending) return;
    if (!validate()) {
      toast.error("Please fix the highlighted errors before saving.");
      return;
    }

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

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-xs text-muted-foreground">{company.companyCode}</p>
        <h1 className="text-xl font-semibold">Log a call — {company.companyName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every field marked * is mandatory before the call can be saved.
          Handoff unlocks only when the requirement is complete.
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
              onUpdate={handleReqUpdate}
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

          <Separator />

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="bg-[#620124] hover:bg-[#7B1A36]"
            >
              {isPending ? "Saving…" : "Save call"}
            </Button>
          </div>

          {isMandatoryMissing && !isPending && (
            <p className="text-xs text-muted-foreground">
              Fill all mandatory fields (contact, disposition, comment, next
              step, next action date) to enable Save.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
