import { z } from "zod";

/** Add/edit client form, and the body of POST/PATCH /companies/:companyId/clients. */
export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  address: z.string().trim().min(1, "Address is required"),
  vatNo: z.string().trim().min(1, "VAT number is required"),
  contactNo: z.string().trim().min(1, "Contact number is required"),
});
export type ClientInput = z.infer<typeof clientInputSchema>;

export const clientStatusValues = ["active", "inactive"] as const;
export type ClientStatus = (typeof clientStatusValues)[number];

/** Body of PATCH /companies/:companyId/clients/:id/status. */
export const clientStatusSchema = z.object({
  status: z.enum(clientStatusValues),
});
export type ClientStatusInput = z.infer<typeof clientStatusSchema>;

/** A client as the API returns it. */
export type ClientDto = {
  id: string;
  name: string;
  address: string;
  vatNo: string;
  contactNo: string;
  status: ClientStatus;
  /** Invoices that are not paid or cancelled. */
  activeInvoiceCount: number;
  /** Sum of outstanding amounts on those invoices. */
  outstandingInvoiceAmount: number;
  createdAt: string;
};
