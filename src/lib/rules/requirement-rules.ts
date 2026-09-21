/**
 * Save-time rules for "Save & Validate Roles". Pure functions, no DB or React:
 * the call form runs them for inline errors and logCall runs the same code
 * before writing, so the two can never disagree.
 *
 *   R1  a count that is new or changed in this save needs a Hiring now call
 *   R2  a role closed as "No requirement" has count 0 and no route
 *   R3  timing "Not hiring" means every count is 0
 *   R4  count > 0 needs route, qualification, experience, handoff comment and
 *       a valid mobile in the same save (validated = handed over)
 *   R5  a route needs count > 0
 *   R6  Hiring now with open roles needs at least one role validated
 */

export type RuleRole = {
  id: string;
  roleName: string;
  roleNameEdited?: string;
  requiredCountValidated?: number | null;
  qualification?: string;
  experienceFrom?: number | null;
  experienceTo?: number | null;
  classification?: string;
  collectorDistrict?: string;
  handoffComment?: string;
  status?: string;
};

export type RuleViolation = {
  /** Index into the roles array; -1 for a call-level rule. */
  roleIndex: number;
  rule: "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "DATE";
  message: string;
};

export type Timing = { timing: "now" | "later" | "not_hiring"; timingDate: string | null };

const NOT_HIRING_DISPOSITIONS = new Set(["no_requirement", "not_operational", "do_not_call"]);

/**
 * Role timing implied by the call outcome. Returns null for outcomes that say
 * nothing about hiring (no answer, wrong contact, duplicate), in which case
 * the role keeps whatever timing it already had.
 */
export function deriveTiming(disposition: string, followUpDate?: string | null): Timing | null {
  if (disposition === "hiring_now") return { timing: "now", timingDate: null };
  if (disposition === "hiring_later") return { timing: "later", timingDate: followUpDate || null };
  if (NOT_HIRING_DISPOSITIONS.has(disposition)) return { timing: "not_hiring", timingDate: null };
  return null;
}

/** Hiring later must carry a valid future date (it is the follow-up anchor). */
export function checkFollowUpDate(disposition: string, followUpDate?: string | null): RuleViolation | null {
  if (disposition !== "hiring_later") return null;
  if (!followUpDate || !/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) {
    return { roleIndex: -1, rule: "DATE", message: "Hiring later needs the month they expect to hire — pick a follow-up date." };
  }
  const today = new Date().toISOString().split("T")[0];
  if (followUpDate < today) {
    return { roleIndex: -1, rule: "DATE", message: "Hiring later follow-up date cannot be in the past." };
  }
  return null;
}

const count = (n: number | null | undefined) => n ?? 0;

export function checkRequirementRules(args: {
  disposition: string;
  followUpDate?: string | null;
  roles: RuleRole[];
  /** Stored count per role id before this save. New roles (id "") are absent. */
  originalCounts: Record<string, number | null>;
  hasValidMobile: boolean;
}): RuleViolation[] {
  const { disposition, followUpDate, roles, originalCounts, hasValidMobile } = args;
  const out: RuleViolation[] = [];
  const timing = deriveTiming(disposition, followUpDate)?.timing ?? null;

  const dateIssue = checkFollowUpDate(disposition, followUpDate);
  if (dateIssue) out.push(dateIssue);

  roles.forEach((r, i) => {
    const name = r.roleNameEdited || r.roleName || `Role ${i + 1}`;
    const n = count(r.requiredCountValidated);
    const closed = r.status === "no_requirement";
    const routed = !!r.classification;
    const before = r.id && r.id in originalCounts ? count(originalCounts[r.id]) : 0;
    const countChanged = n !== before;

    if (closed) {
      if (n > 0 || routed) {
        out.push({ roleIndex: i, rule: "R2", message: `${name}: marked "not required any more" — set count to 0 and clear the route.` });
      }
      return;
    }

    if (n > 0 && countChanged && disposition !== "hiring_now") {
      out.push({ roleIndex: i, rule: "R1", message: `${name}: a count can only be entered on a "Connected — hiring now" call.` });
    }

    if (n > 0 && timing === "not_hiring") {
      out.push({ roleIndex: i, rule: "R3", message: `${name}: the employer is not hiring — count must be 0.` });
    }

    if (n > 0) {
      const missing: string[] = [];
      if (!r.qualification) missing.push("qualification");
      if (r.experienceFrom == null || r.experienceTo == null) missing.push("experience from/to");
      if (!routed) missing.push("route");
      if (!r.handoffComment?.trim()) missing.push("handoff comment");
      if (r.classification === "collector" && !r.collectorDistrict) missing.push("collector district");
      if (!hasValidMobile) missing.push("a contact with a valid mobile");
      if (missing.length > 0) {
        out.push({ roleIndex: i, rule: "R4", message: `${name}: count entered — also needs ${missing.join(", ")}.` });
      }
    }

    if (routed && n === 0) {
      out.push({ roleIndex: i, rule: "R5", message: `${name}: route chosen but count is 0 — enter the count or clear the route.` });
    }
  });

  const openRoles = roles.filter((r) => r.status !== "no_requirement");
  if (disposition === "hiring_now" && openRoles.length > 0 && !openRoles.some((r) => count(r.requiredCountValidated) > 0)) {
    out.push({ roleIndex: -1, rule: "R6", message: `"Hiring now" selected — enter a count on at least one role, or use "Save Call Only".` });
  }

  return out;
}

/** True when a mobile has at least 10 digits and the contact is not marked invalid. */
export function isValidMobileContact(c: { valid: boolean; mobile: string | null }): boolean {
  return c.valid && !!c.mobile && c.mobile.replace(/\D/g, "").length >= 10;
}
