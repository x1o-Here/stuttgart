"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLookupStore } from "@/stores/use-lookup-store";

export function LookupProvider({ children }: { children: React.ReactNode }) {
  const { user, activeCompany } = useAuth();

  const subscribeAll = useLookupStore((state) => state.subscribeAll);

  useEffect(() => {
    if (!user || !activeCompany) return;

    const unsubscribe = subscribeAll(activeCompany, user.uid);

    return unsubscribe;
  }, [user, activeCompany, subscribeAll]);

  return children;
}
