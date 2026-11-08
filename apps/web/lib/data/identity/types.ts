export type ProfileData = {
  username: string | null;
  role: string | null;
  companies: { id: string; name: string }[];
};

/** A row on the Users tab (same shape as users/components/columns UserData). */
export type UserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  companies: string[];
  companyNames?: string[];
  createdAt?: unknown;
  removed: boolean;
};

/** A row on the Audit log tab (same shape as audit-logs-columns AuditLogRow). */
export type AuditLogEntry = {
  id: string;
  action: string;
  description: string;
  companyId: string;
  companyName: string;
  userId: string;
  username: string;
  transactionId: string;
  entityStatus: boolean;
  createdAt: Date | null;
};

export type CompanyFields = {
  name: string;
  address: string;
  telephoneNo: string;
  tin: string;
};
