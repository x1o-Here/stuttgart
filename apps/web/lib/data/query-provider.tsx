"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onDataChanged } from "./live";

/**
 * Shared TanStack Query cache. Data is considered fresh for 30s and is
 * refetched when the window regains focus, which replaces most of what the
 * Firestore onSnapshot listeners did. Any write through the API
 * (dataChanged()) refreshes everything that's on screen.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );
  useEffect(
    () => onDataChanged(() => void client.invalidateQueries()),
    [client],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
