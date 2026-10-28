"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { canAccessPath } from "@/lib/auth/roles";

/**
 * Keeps restricted roles on the routes they may use. Mechanics can open only
 * Inventory and Profile; anything else (including "/" after sign-in) is
 * replaced with /inventory before it renders.
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = canAccessPath(role, pathname);

  useEffect(() => {
    if (!loading && !allowed) router.replace("/inventory");
  }, [allowed, loading, router]);

  if (!allowed) return null;
  return children;
}
