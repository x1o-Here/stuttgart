"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { type CompanyRecord, mapCompanyDoc } from "@/lib/companies/types";
import { onLiveDoc } from "@/lib/data/live";

/**
 * The active company's record, kept live. `vatRegistered` is true until the
 * record has loaded, so VAT figures don't flicker off for VAT companies.
 */
export function useActiveCompany() {
  const { activeCompany } = useAuth();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) {
      setCompany(null);
      setLoading(true);
      return;
    }
    setLoading(true);
    return onLiveDoc(
      "ledger",
      ["companies", activeCompany],
      (snapshot) => {
        setCompany(
          snapshot.exists()
            ? mapCompanyDoc(
                snapshot.id,
                snapshot.data() as Record<string, unknown>,
              )
            : null,
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load the active company:", error);
        setLoading(false);
      },
    );
  }, [activeCompany]);

  return {
    company,
    loading,
    vatRegistered: company?.vatRegistered ?? true,
  };
}
