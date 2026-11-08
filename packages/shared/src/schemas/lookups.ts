import { z } from "zod";

/** Settings lookup lists (and fleet vehicles), addressed as /companies/:c/lookups/:kind. */
export const lookupKinds = [
  "account-types",
  "departments",
  "supplier-types",
  "vehicles",
] as const;
export type LookupKind = (typeof lookupKinds)[number];
export const lookupKindSchema = z.enum(lookupKinds);

export const lookupInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  shortForm: z.string().trim().max(20).optional().default(""),
  /** Vehicles only. */
  description: z.string().trim().max(500).optional().default(""),
});
export type LookupInput = z.input<typeof lookupInputSchema>;

/** Partial update (fields left out stay as they are). */
export const lookupUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  shortForm: z.string().trim().max(20).optional(),
  description: z.string().trim().max(500).optional(),
});
export type LookupUpdate = z.input<typeof lookupUpdateSchema>;

export type LookupItemDto = {
  id: string;
  name: string;
  shortForm: string;
  description: string;
  isSystem: boolean;
  entityStatus: boolean;
  createdAt: string;
};

/** GET /companies/:c/lookups — all four lists in one call. */
export type LookupsDto = {
  accountTypes: LookupItemDto[];
  departments: LookupItemDto[];
  supplierTypes: LookupItemDto[];
  vehicles: LookupItemDto[];
};
