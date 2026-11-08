import { z } from "zod";

/** Spare part form, and the body of POST/PATCH /companies/:c/spare-parts[/:id]. */
export const sparePartInputSchema = z.object({
  partId: z.string().trim().min(1, "Part ID is required").max(60, "Too long"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(300, "Keep it under 300 characters"),
});
export type SparePartInput = z.infer<typeof sparePartInputSchema>;

/** POST /spare-parts/:id/assign */
export const sparePartAssignSchema = z.object({ vehicleId: z.string().min(1) });

/** POST /spare-parts/:id/release — back to stock, or scrapped. */
export const sparePartReleaseSchema = z.object({ mode: z.enum(["stock", "scrapped"]) });
