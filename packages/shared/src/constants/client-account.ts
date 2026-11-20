/** System account type used for per-client ledger accounts. */
export const CLIENT_ACCOUNT_TYPE_NAME = "Client";
export const CLIENT_ACCOUNT_TYPE_SHORT_FORM = "CL";

export function isClientAccountTypeName(
  name: string | undefined | null,
): boolean {
  return (
    (name ?? "").trim().toLowerCase() === CLIENT_ACCOUNT_TYPE_NAME.toLowerCase()
  );
}

export const SUPPLIER_ACCOUNT_TYPE_NAME = "Supplier";
export const SUPPLIER_ACCOUNT_TYPE_SHORT_FORM = "SP";

export function isSupplierAccountTypeName(
  name: string | undefined | null,
): boolean {
  return (
    (name ?? "").trim().toLowerCase() ===
    SUPPLIER_ACCOUNT_TYPE_NAME.toLowerCase()
  );
}

/** System account type for per-vehicle ledger accounts. */
export const VEHICLE_ACCOUNT_TYPE_NAME = "Vehicle";
export const VEHICLE_ACCOUNT_TYPE_SHORT_FORM = "VH";

export function isVehicleAccountTypeName(
  name: string | undefined | null,
): boolean {
  return isNamed(name, VEHICLE_ACCOUNT_TYPE_NAME);
}

/** A vehicle's account is named after its number: "Vehicle (WP-1234)". */
export function vehicleAccountName(vehicleNumber: string): string {
  return `${VEHICLE_ACCOUNT_TYPE_NAME} (${vehicleNumber.trim()})`;
}

/** System account type for per-employee ledger accounts and the company's EPF / ETF accounts. */
export const EMPLOYEE_ACCOUNT_TYPE_NAME = "Employee";
export const EMPLOYEE_ACCOUNT_TYPE_SHORT_FORM = "EM";

export function isEmployeeAccountTypeName(
  name: string | undefined | null,
): boolean {
  return isNamed(name, EMPLOYEE_ACCOUNT_TYPE_NAME);
}

/** An employee's account is named after them: "EMP_<name>". */
export function employeeAccountName(employeeName: string): string {
  return `EMP_${employeeName.trim()}`;
}

/** One EPF and one ETF account per company, shared by all employees. */
export const EPF_ACCOUNT_NAME = "EPF";
export const ETF_ACCOUNT_NAME = "ETF";

/** System account on the other side of every client invoice entry. */
export const SALES_ACCOUNT_TYPE_NAME = "Sales";
export const SALES_ACCOUNT_TYPE_SHORT_FORM = "SL";

/** System account on the other side of every supplier invoice entry. */
export const PURCHASES_ACCOUNT_TYPE_NAME = "Purchases";
export const PURCHASES_ACCOUNT_TYPE_SHORT_FORM = "PU";

function isNamed(name: string | undefined | null, wanted: string): boolean {
  return (name ?? "").trim().toLowerCase() === wanted.toLowerCase();
}

/** Account types hidden from the Accounts dashboard unless explicitly filtered. */
export function isHiddenByDefaultAccountType(
  name: string | undefined | null,
): boolean {
  return (
    isClientAccountTypeName(name) ||
    isSupplierAccountTypeName(name) ||
    isVehicleAccountTypeName(name)
  );
}

/** Client, Supplier, Vehicle, Employee, Sales and Purchases account types are created and managed by the system. */
export function isSystemAccountTypeName(
  name: string | undefined | null,
): boolean {
  return (
    isClientAccountTypeName(name) ||
    isSupplierAccountTypeName(name) ||
    isVehicleAccountTypeName(name) ||
    isEmployeeAccountTypeName(name) ||
    isNamed(name, SALES_ACCOUNT_TYPE_NAME) ||
    isNamed(name, PURCHASES_ACCOUNT_TYPE_NAME)
  );
}

export function isProtectedAccountType(item: {
  name?: string | null;
  isSystem?: boolean;
}): boolean {
  return item.isSystem === true || isSystemAccountTypeName(item.name);
}
