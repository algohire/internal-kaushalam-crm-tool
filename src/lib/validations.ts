import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

const futureDateMax12m = dateSchema.refine((d) => {
  const date = new Date(d);
  const today = new Date(new Date().toISOString().split("T")[0]);
  const max = new Date();
  max.setMonth(max.getMonth() + 12);
  return date >= today && date <= max;
}, "Date must be between today and 12 months ahead");

export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

export const addContactSchema = z.object({
  companyCode: z.string().min(1, "Company code required"),
  name: z.string().min(1, "Name required").max(200, "Name too long"),
  designation: z.string().max(200, "Designation too long").optional().default(""),
  mobile: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || /^\d{7,15}$/.test(v.replace(/\D/g, "")), "Invalid phone number"),
  email: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email format"),
  pocFor: z.string().optional().default("requirement"),
});

export const createUserSchema = z.object({
  name: z.string().min(1, "Name required").max(200, "Name too long"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Minimum 6 characters"),
  role: z.enum(["caller", "admin"], { message: "Role must be caller or admin" }),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1, "User ID required"),
  newPassword: z.string().min(6, "Minimum 6 characters"),
});

export const updateTagsSchema = z.object({
  companyCode: z.string().min(1, "Company code required"),
  tags: z.array(z.string().max(100, "Tag too long")),
});

const requirementUpdateSchema = z.object({
  id: z.string(),
  roleName: z.string().optional().default(""),
  requiredCount: z.number().nullable().optional(),
  roleNameEdited: z.string().max(200).optional().default(""),
  requiredCountValidated: z.number().int().min(0).max(99999).nullable().optional(),
  qualification: z.string().max(5000).optional().default(""),
  experienceFrom: z.number().int().min(0).max(15).nullable().optional(),
  experienceTo: z.number().int().min(0).max(15).nullable().optional(),
  genderPreference: z.string().max(50).optional().default(""),
  ageLimit: z.string().max(50).optional().default(""),
  salary: z.string().max(100).optional().default(""),
  pwd: z.boolean().optional().default(false),
  needTraining: z.boolean(),
  qpCode: z.string().max(50).optional().default(""),
  classification: z.string().optional().default(""),
  collectorDistrict: z.string().optional().default(""),
  handoffComment: z.string().max(2000).optional().default(""),
  status: z.string().optional().default(""),
  handoff: z.boolean().optional().default(false),
});

export const callSchema = z.object({
  companyCode: z.string().min(1, "Company code required"),
  contactId: z.string().min(1, "Contact required"),
  channel: z.string().min(1, "Channel required"),
  disposition: z.string().min(1, "Disposition required"),
  reasonCode: z.string().optional().default(""),
  comment: z.string().min(1, "Comment required").max(5000, "Comment too long"),
  timing: z.string().optional().default(""),
  timingDate: z.string().optional().default(""),
  nextStep: z.string().min(1, "Next step required").max(500, "Next step too long"),
  nextActionDate: futureDateMax12m,
  requirements: z.array(requirementUpdateSchema),
  callOnly: z.boolean().optional().default(false),
});

export function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
