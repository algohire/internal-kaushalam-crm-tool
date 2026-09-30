"use client";

import { Check, X } from "lucide-react";
import type { RequirementUpdate } from "@/lib/actions/call";
import { isValidMobileContact } from "@/lib/rules/requirement-rules";

type Contact = {
  id: string;
  mobile: string | null;
  valid: boolean;
};

type GateCheck = {
  label: string;
  passed: boolean;
};

function getGateChecks(
  req: RequirementUpdate,
  hasValidMobile: boolean
): GateCheck[] {
  const checks: GateCheck[] = [
    {
      label: "Role title",
      passed: !!(req.roleNameEdited || req.roleName),
    },
    {
      label: "Validated count",
      passed: req.requiredCountValidated != null && req.requiredCountValidated > 0,
    },
    {
      label: "Qualification",
      passed: !!req.qualification,
    },
    {
      label: "Experience",
      passed: req.experienceFrom != null && req.experienceTo != null,
    },
    {
      label: "Classification",
      passed: !!req.classification,
    },
    {
      label: "Handoff comment",
      passed: !!req.handoffComment?.trim(),
    },
    {
      label: "Contact with valid phone",
      passed: hasValidMobile,
    },
  ];

  if (req.classification === "collector") {
    checks.push({
      label: "Collector district",
      passed: !!req.collectorDistrict,
    });
  }

  return checks;
}

function routeLabel(classification: string | undefined): string {
  switch (classification) {
    case "kaushalam":
      return "Scheduling";
    case "apssdc":
      return "APSSDC via EDB";
    case "collector":
      return "the District Collector";
    default:
      return "the receiving team";
  }
}

type Props = {
  requirements: RequirementUpdate[];
  contacts: Contact[];
};

export function HandoffGate({ requirements, contacts }: Props) {
  const hasValidMobile = contacts.some(isValidMobileContact);

  return (
    <div className="space-y-3">
      {requirements.map((req, idx) => {
        if (req.status === "no_requirement") return null;
        if (!req.classification) return null;

        const checks = getGateChecks(req, hasValidMobile);
        const allPassed = checks.every((c) => c.passed);
        const roleName = req.roleNameEdited || req.roleName;

        return (
          <div
            key={req.id || `gate-${idx}`}
            className="border rounded-md p-4 space-y-3"
          >
            <div className="text-sm font-medium">{roleName}</div>
            <ul className="space-y-1">
              {checks.map((check) => (
                <li
                  key={check.label}
                  className="flex items-center gap-2 text-xs"
                >
                  {check.passed ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-destructive" />
                  )}
                  <span
                    className={
                      check.passed
                        ? "text-muted-foreground"
                        : "text-destructive font-medium"
                    }
                  >
                    {check.label}
                    {!check.passed && " — missing"}
                  </span>
                </li>
              ))}
            </ul>
            <p className={`text-xs ${allPassed ? "text-green-700" : "text-muted-foreground"}`}>
              {allPassed
                ? `Saving now sends this role to ${routeLabel(req.classification)}.`
                : "Fill the fields above — saving will send this role to the receiving team."}
            </p>
          </div>
        );
      })}
    </div>
  );
}
