import rawDropdowns from "../../../interim/reference/dropdowns.json";

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

export const dispositions = rawDropdowns.disposition as Disposition[];
export const noRequirementReasons = rawDropdowns.no_requirement_reason;
export const timingOptions = rawDropdowns.timing;
export const qualifications = rawDropdowns.qualification;
export const experiences = rawDropdowns.experience;
export const genderPreferences = rawDropdowns.gender_preference;
export const classifications = rawDropdowns.classification as Classification[];
export const requirementStatuses = rawDropdowns.requirement_status;
export const tags = rawDropdowns.tags;
export const channels = rawDropdowns.channel;
export const companyStages = rawDropdowns.company_stage_from_edb;
export const userRoles = rawDropdowns.user_role;
export const rules = rawDropdowns.rules;

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
