import type {
  LookupInput,
  LookupItemDto,
  LookupKind,
  LookupsDto,
  LookupUpdate,
} from "@stuttgart/shared/schemas/lookups";
import { api } from "@/lib/api-client";

/** The store's item shape (see stores/use-lookup-store.ts). */
export type LookupItemData = {
  id: string;
  name: string;
  shortForm?: string;
  description?: string;
  entityStatus: boolean;
  isSystem?: boolean;
  createdAt?: Date;
};

const fromDto = (d: LookupItemDto): LookupItemData => ({
  id: d.id,
  name: d.name,
  shortForm: d.shortForm,
  description: d.description,
  entityStatus: d.entityStatus,
  isSystem: d.isSystem,
  createdAt: new Date(d.createdAt),
});

const base = (companyId: string) => `/companies/${companyId}/lookups`;

/** Lookup lists through apps/server. */
export const lookupsApi = {
  async all(companyId: string) {
    const { data } = await api.get<LookupsDto>(base(companyId));
    return {
      accountTypes: data.accountTypes.map(fromDto),
      departments: data.departments.map(fromDto),
      supplierTypes: data.supplierTypes.map(fromDto),
      vehicles: data.vehicles.map(fromDto),
    };
  },
  async create(companyId: string, kind: LookupKind, input: LookupInput) {
    await api.post(`${base(companyId)}/${kind}`, input);
  },
  async update(
    companyId: string,
    kind: LookupKind,
    id: string,
    input: LookupUpdate,
  ) {
    await api.patch(`${base(companyId)}/${kind}/${id}`, input);
  },
  async remove(companyId: string, kind: LookupKind, id: string) {
    await api.delete(`${base(companyId)}/${kind}/${id}`);
  },
};
