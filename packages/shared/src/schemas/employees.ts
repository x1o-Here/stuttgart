import { z } from "zod";

/** Add/edit employee form, and the body of POST/PATCH /companies/:companyId/employees. */
export const employeeInputSchema = z.object({
  employeeNo: z
    .string()
    .trim()
    .min(1, "Employee number is required")
    .max(40, "Too long"),
  name: z.string().trim().min(1, "Name is required").max(120, "Too long"),
  role: z.string().trim().min(1, "Role is required").max(80, "Too long"),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;

/** An employee as the API returns it. */
export type EmployeeDto = {
  id: string;
  employeeNo: string;
  name: string;
  role: string;
  /** The employee's own "EMP_<name>" ledger account. */
  accountId: string | null;
  createdAt: string;
};
