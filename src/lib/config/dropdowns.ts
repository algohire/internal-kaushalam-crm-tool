export type Disposition = {
  code: string;
  label: string;
  connected: boolean;
  requires_reason: boolean;
  requires_date?: boolean;
};

export type Classification = {
  code: string;
  label: string;
};

export const dispositions: Disposition[] = [
  { code: "no_answer", label: "Attempted — no answer", connected: false, requires_reason: false },
  { code: "wrong_contact", label: "Wrong contact / invalid number", connected: false, requires_reason: false },
  { code: "hiring_now", label: "Connected — hiring now", connected: true, requires_reason: false },
  { code: "hiring_later", label: "Connected — hiring later", connected: true, requires_reason: false, requires_date: true },
  { code: "no_requirement", label: "Connected — no requirement", connected: true, requires_reason: true },
  { code: "not_operational", label: "Not operational / closed", connected: true, requires_reason: false },
  { code: "do_not_call", label: "Do not call", connected: true, requires_reason: true },
  { code: "duplicate", label: "Duplicate of another company", connected: false, requires_reason: false },
];

export const noRequirementReasons = [
  "No expansion planned",
  "Hiring through own channels",
  "Hiring through contractor / agency",
  "Seasonal — not this season",
  "Unit not yet commissioned",
  "Requirement already filled",
  "Other (comment)",
];

export const timingOptions = ["now", "later", "not_hiring"];

export const qualifications = [
  "No formal qualification",
  "8th",
  "10th",
  "Intermediate",
  "ITI",
  "Diploma",
  "Graduate — Arts / Science / Commerce",
  "Graduate — B.Sc",
  "Graduate — B.Tech / BE",
  "Graduate — B.Pharm",
  "Post-graduate — M.Sc",
  "Post-graduate — MBA / MCA / M.Tech",
  "Post-graduate — M.Pharm",
  "Other (comment)",
];

export const experiences = [
  "Fresher",
  "0–1 years",
  "1–3 years",
  "3–5 years",
  "5+ years",
  "Any",
];

export const genderPreferences = ["Any", "Male", "Female"];

export const classifications: Classification[] = [
  { code: "kaushalam", label: "Direct hiring — Kaushalam (assessed, job-ready pool)" },
  { code: "apssdc", label: "Needs training — APSSDC (via EDB)" },
  { code: "collector", label: "Collector handoff (unskilled / semi-skilled, local mobilisation)" },
];

export const requirementStatuses = [
  "captured", "attempting", "validated",
  "handed_over_scheduling", "handed_over_collector", "handed_over_apssdc",
  "future", "no_requirement", "not_operational", "do_not_call", "duplicate",
];

export const tags = [
  "Recurring requirement",
  "Continuous hiring",
  "Seasonal hiring",
  "High volume",
  "Priority account",
];

export const channels = ["call", "whatsapp", "email", "visit", "inbound"];

export const companyStages = [
  "preconstruction", "construction", "trial_production", "commercial_production", "unknown",
];

export const userRoles = ["caller", "admin"];

export const rules = {
  next_action_date_max_months_ahead: 12,
  retry_attempts_before_park: 3,
  retry_window_working_days: 5,
  validation_sla_hours: 24,
  claim_expires: "midnight local time",
  mandatory_every_call: ["contact", "channel", "disposition", "comment", "next_step", "next_action_date"],
  mandatory_for_handoff_per_requirement: ["role_name", "required_count_validated", "qualification", "experience", "classification", "handoff_comment"],
  mandatory_for_handoff_company: ["contact_with_valid_mobile"],
  mandatory_if_collector: ["collector_district"],
  mandatory_if_apssdc: ["need_training=true"],
  qp_code: "optional until QP master is loaded",
};

export function getDisposition(code: string): Disposition | undefined {
  return dispositions.find((d) => d.code === code);
}

export function isConnectedDisposition(code: string): boolean {
  return getDisposition(code)?.connected ?? false;
}

export function dispositionRequiresReason(code: string): boolean {
  return getDisposition(code)?.requires_reason ?? false;
}

export function dispositionRequiresDate(code: string): boolean {
  return getDisposition(code)?.requires_date ?? false;
}
