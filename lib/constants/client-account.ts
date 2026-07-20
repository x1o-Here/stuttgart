/** System account type used for per-client ledger accounts. */
export const CLIENT_ACCOUNT_TYPE_NAME = "Client";
export const CLIENT_ACCOUNT_TYPE_SHORT_FORM = "CL";

export function isClientAccountTypeName(name: string | undefined | null): boolean {
  return (name ?? "").trim().toLowerCase() === CLIENT_ACCOUNT_TYPE_NAME.toLowerCase();
}

export function isProtectedAccountType(item: {
  name?: string | null;
  isSystem?: boolean;
}): boolean {
  return item.isSystem === true || isClientAccountTypeName(item.name);
}
