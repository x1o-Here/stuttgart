import type {
  AuditLogDto,
  CompanyDto,
  CompanyInput,
  MeDto,
  RoleValue,
  UserDto,
} from "@stuttgart/shared/schemas/identity";
import { api } from "@/lib/api-client";

/** Profile, users, companies and audit log through apps/server ("identity" slice). */
export const identityApi = {
  me: async () => (await api.get<MeDto>("/me")).data,

  updateUsername: async (username: string) => {
    await api.patch("/me", { username });
  },

  logPasswordChange: async () => {
    await api.post("/me/password-changed");
  },

  listUsers: async () => {
    const { data } = await api.get<UserDto[]>("/users");
    return data.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role as string,
      companies: u.companies,
      companyNames: u.companyNames,
      createdAt: new Date(u.createdAt),
      removed: u.removed,
    }));
  },

  createUser: async (input: {
    username: string;
    email: string;
    role: RoleValue;
    companies: string[];
  }) => (await api.post<UserDto>("/users", input)).data,

  removeUser: async (uid: string) => {
    await api.post(`/users/${uid}/remove`);
  },

  companyOptions: async () =>
    (await api.get<{ id: string; name: string }[]>("/companies/options")).data,

  listCompanies: async () => (await api.get<CompanyDto[]>("/companies")).data,

  createCompany: async (input: CompanyInput) => {
    await api.post("/companies", input);
  },

  updateCompany: async (id: string, input: CompanyInput) => {
    await api.patch(`/companies/${id}`, input);
  },

  setCompanyActive: async (id: string, active: boolean) => {
    await api.patch(`/companies/${id}/status`, { active });
  },

  auditLogs: async () => {
    const { data } = await api.get<AuditLogDto[]>("/audit-logs");
    return data.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description,
      companyId: log.companyId,
      companyName: log.companyName,
      userId: log.userId,
      username: log.username,
      transactionId: log.entityId,
      entityStatus: log.entityStatus,
      createdAt: new Date(log.createdAt),
    }));
  },
};
