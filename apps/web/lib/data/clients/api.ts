import type { ClientDto } from "@stuttgart/shared/schemas/clients";
import { ApiError, api } from "@/lib/api-client";
import type { Client, ClientInput, ClientStatus } from "./types";

const base = (companyId: string) => `/companies/${companyId}/clients`;

function fromDto(dto: ClientDto): Client {
  return {
    id: dto.id,
    name: dto.name,
    address: dto.address,
    vatNo: dto.vatNo,
    contactNo: dto.contactNo,
    status: dto.status,
    activeInvoiceCount: dto.activeInvoiceCount,
    outstandingInvoiceAmount: dto.outstandingInvoiceAmount,
  };
}

/** Clients through apps/server. */
export const clientsApi = {
  async list(companyId: string): Promise<Client[]> {
    const { data } = await api.get<ClientDto[]>(base(companyId));
    return data.map(fromDto);
  },

  /** Resolves to null when the client doesn't exist (or belongs to another company). */
  async get(companyId: string, id: string): Promise<Client | null> {
    try {
      const { data } = await api.get<ClientDto>(`${base(companyId)}/${id}`);
      return fromDto(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async create(companyId: string, input: ClientInput): Promise<void> {
    await api.post(base(companyId), input);
  },

  async update(
    companyId: string,
    id: string,
    input: ClientInput,
  ): Promise<void> {
    await api.patch(`${base(companyId)}/${id}`, input);
  },

  async setStatus(
    companyId: string,
    id: string,
    status: ClientStatus,
  ): Promise<void> {
    await api.patch(`${base(companyId)}/${id}/status`, { status });
  },
};
