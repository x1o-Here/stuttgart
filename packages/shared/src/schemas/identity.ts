import { z } from "zod";

export const roleValues = ["admin", "manager", "general", "technician"] as const;
export type RoleValue = (typeof roleValues)[number];

// ── Me ───────────────────────────────────────────────────────────────────

/** GET /me — the signed-in user's profile. */
export type MeDto = {
  uid: string;
  username: string;
  role: RoleValue;
  /** Active companies the user belongs to. */
  companies: { id: string; name: string }[];
};

/** PATCH /me */
export const meUpdateSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(80, "Too long"),
});
export type MeUpdate = z.infer<typeof meUpdateSchema>;

// ── Users ────────────────────────────────────────────────────────────────

/** Add user form, and the body of POST /users (the server lower-cases the email). */
export const userCreateSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(80, "Too long"),
  email: z.string().trim().min(1, "Email is required").email("Invalid email address"),
  companies: z.array(z.string()).min(1, "Companies are required"),
  role: z.enum(roleValues, { error: "Role is required" }),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export type UserDto = {
  id: string;
  username: string;
  email: string;
  role: RoleValue;
  companies: string[];
  companyNames: string[];
  /** Removed accounts stay listed so their history remains traceable. */
  removed: boolean;
  createdAt: string;
};

// ── Companies ────────────────────────────────────────────────────────────

/** Company form, and the body of POST/PATCH /companies[/:id]. */
export const companyInputSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(160),
  address: z.string().trim().min(1, "Address is required"),
  telephoneNo: z.string().trim().min(1, "Telephone number is required"),
  tin: z.string().trim().min(1, "TIN is required"),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

export const companyStatusSchema = z.object({ active: z.boolean() });
export type CompanyStatusInput = z.infer<typeof companyStatusSchema>;

export type CompanyDto = {
  id: string;
  name: string;
  address: string;
  telephoneNo: string;
  tin: string;
  entityStatus: boolean;
};

// ── Audit log ────────────────────────────────────────────────────────────

export type AuditLogDto = {
  id: string;
  action: string;
  description: string;
  companyId: string;
  companyName: string;
  userId: string;
  /** "(removed)" is appended for removed accounts. */
  username: string;
  entityId: string;
  entityStatus: boolean;
  createdAt: string;
};
