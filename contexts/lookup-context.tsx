"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLookupStore } from "@/stores/use-lookup-store";

/**
 * Bootstraps the lookup Zustand store subscription for the active company.
 * Not a React Context — consumers read via useLookupStore selectors.
 */
export function LookupSubscription({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, activeCompany } = useAuth();
  const subscribeAll = useLookupStore((state) => state.subscribeAll);

  useEffect(() => {
    if (!user || !activeCompany) return;
    return subscribeAll(activeCompany, user.uid);
  }, [user, activeCompany, subscribeAll]);

  return children;
}
