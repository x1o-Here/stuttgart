import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * Firestore mode only: keeps a TanStack Query cache entry filled from an
 * onSnapshot listener, so components read the same `useQuery` data whether
 * a slice runs on Firestore or on the API.
 *
 * In Firestore mode the matching `useQuery` is disabled, so treat
 * `data === undefined` as "still loading".
 */
export function useFirestoreFeed<T>(
  enabled: boolean,
  queryKey: QueryKey,
  subscribe: (onData: (data: T) => void) => () => void,
) {
  const queryClient = useQueryClient();
  const key = JSON.stringify(queryKey);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-subscribe only when the key or mode changes
  useEffect(() => {
    if (!enabled) return;
    return subscribe((data) => queryClient.setQueryData(queryKey, data));
  }, [enabled, key]);
}
