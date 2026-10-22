/** System account type used for per-client ledger accounts. */
export const CLIENT_ACCOUNT_TYPE_NAME = "Client";
export const CLIENT_ACCOUNT_TYPE_SHORT_FORM = "CL";

export function isClientAccountTypeName(name: string | undefined | null): boolean {
  return (name ?? "").trim().toLowerCase() === CLIENT_ACCOUNT_TYPE_NAME.toLowerCase();
}

export const SUPPLIER_ACCOUNT_TYPE_NAME = "Supplier";

export function isSupplierAccountTypeName(name: string | undefined | null): boolean {
  return (name ?? "").trim().toLowerCase() === SUPPLIER_ACCOUNT_TYPE_NAME.toLowerCase();
}

/** Account types hidden from the Accounts dashboard unless explicitly filtered. */
export function isHiddenByDefaultAccountType(name: string | undefined | null): boolean {
  return isClientAccountTypeName(name) || isSupplierAccountTypeName(name);
}

export function isProtectedAccountType(item: {
  name?: string | null;
  isSystem?: boolean;
}): boolean {
  return item.isSystem === true || isClientAccountTypeName(item.name);
}
