/**
 * Client hooks for the screens. Each one works on Firestore or on the API
 * depending on the "ledger" feature flag; components don't need to know which.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { usesApi } from "../flags";
import { useFirestoreFeed } from "../use-firestore-feed";
import { clientsApi } from "./api";
import * as firestore from "./firestore";
import type { Client, ClientInput, ClientStatus } from "./types";

export type { Client, ClientInput, ClientStatus } from "./types";

const FEATURE = "ledger";

export const clientKeys = {
  all: (companyId: string) => ["clients", companyId] as const,
  list: (companyId: string) => ["clients", companyId, "list"] as const,
  detail: (companyId: string, id: string) =>
    ["clients", companyId, "detail", id] as const,
};

/** The company's clients with open-invoice totals. `data` is undefined while loading. */
export function useClients(companyId: string) {
  const api = usesApi(FEATURE);
  useFirestoreFeed<Client[]>(
    !api && !!companyId,
    clientKeys.list(companyId),
    (onData) => firestore.subscribeClients(companyId, onData),
  );
  return useQuery({
    queryKey: clientKeys.list(companyId),
    queryFn: () => clientsApi.list(companyId),
    enabled: api && !!companyId,
  });
}

/** One client. `data` is undefined while loading and null when not found. */
export function useClient(companyId: string, id: string) {
  const api = usesApi(FEATURE);
  useFirestoreFeed<Client | null>(
    !api && !!companyId && !!id,
    clientKeys.detail(companyId, id),
    (onData) => firestore.subscribeClient(companyId, id, onData),
  );
  return useQuery({
    queryKey: clientKeys.detail(companyId, id),
    queryFn: () => clientsApi.get(companyId, id),
    enabled: api && !!companyId && !!id,
  });
}

/** After any client change: refresh clients, and accounts (clients own one). */
function useInvalidateClients(companyId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: clientKeys.all(companyId) }),
      queryClient.invalidateQueries({ queryKey: ["accounts", companyId] }),
    ]);
}

function useUserId() {
  const { user } = useAuth();
  return () => {
    if (!user) throw new Error("Not signed in");
    return user.uid;
  };
}

export function useCreateClient(companyId: string) {
  const invalidate = useInvalidateClients(companyId);
  const userId = useUserId();
  return useMutation({
    mutationFn: (input: ClientInput) =>
      usesApi(FEATURE)
        ? clientsApi.create(companyId, input)
        : firestore.createClient(companyId, userId(), input),
    onSuccess: invalidate,
  });
}

export function useUpdateClient(companyId: string, id: string) {
  const invalidate = useInvalidateClients(companyId);
  const userId = useUserId();
  return useMutation({
    mutationFn: ({
      input,
      previousName,
    }: {
      input: ClientInput;
      previousName: string;
    }) =>
      usesApi(FEATURE)
        ? clientsApi.update(companyId, id, input)
        : firestore.updateClient(companyId, userId(), id, input, previousName),
    onSuccess: invalidate,
  });
}

export function useSetClientStatus(companyId: string, id: string) {
  const invalidate = useInvalidateClients(companyId);
  const userId = useUserId();
  return useMutation({
    mutationFn: ({
      status,
      clientName,
    }: {
      status: ClientStatus;
      clientName: string;
    }) =>
      usesApi(FEATURE)
        ? clientsApi.setStatus(companyId, id, status)
        : firestore.setClientStatus(
            companyId,
            userId(),
            id,
            clientName,
            status,
          ),
    onSuccess: invalidate,
  });
}
