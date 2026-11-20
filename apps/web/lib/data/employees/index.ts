/**
 * Employees through apps/server (API only; there was never a Firestore
 * version). Each employee owns an "EMP_<name>" ledger account, and the
 * company gets one EPF and one ETF account with its first employee.
 */
import type {
  EmployeeDto,
  EmployeeInput,
} from "@stuttgart/shared/schemas/employees";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { dataChanged } from "../live";

export type { EmployeeInput } from "@stuttgart/shared/schemas/employees";
export type Employee = EmployeeDto;

const base = (companyId: string) => `/companies/${companyId}/employees`;

export const employeeKeys = {
  list: (companyId: string) => ["employees", companyId, "list"] as const,
};

/** The company's employees, newest first. `data` is undefined while loading. */
export function useEmployees(companyId: string) {
  return useQuery({
    queryKey: employeeKeys.list(companyId),
    queryFn: async () => {
      const { data } = await api.get<EmployeeDto[]>(base(companyId));
      return data;
    },
    enabled: !!companyId,
  });
}

export async function createEmployee(companyId: string, input: EmployeeInput) {
  await api.post(base(companyId), input);
  dataChanged();
}

export async function updateEmployee(
  companyId: string,
  id: string,
  input: EmployeeInput,
) {
  await api.patch(`${base(companyId)}/${id}`, input);
  dataChanged();
}
