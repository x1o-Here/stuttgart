"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { use, useMemo } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/contexts/auth-context";
import { type CollectionKey, useLookupStore } from "@/stores/use-lookup-store";
import { getLookupColumns } from "./components/columns/lookup-columns";
import { DataTable } from "./components/data-table";
import CreateModal from "./components/modals/create-modal";

interface PageProps {
  params: Promise<{
    setting: string[];
  }>;
}

// Map URL segments to store states, collections, and labels
const SETTING_MAP: Record<
  string,
  {
    key: CollectionKey;
    storeKey: "accountTypes" | "departments" | "supplierTypes";
    label: string;
  }
> = {
  "account-types": {
    key: "account-types",
    storeKey: "accountTypes",
    label: "Account Type",
  },
  departments: {
    key: "departments",
    storeKey: "departments",
    label: "Department",
  },
  "supplier-types": {
    key: "supplier-types",
    storeKey: "supplierTypes",
    label: "Supplier Type",
  },
};

export default function SettingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const settingSlug = resolvedParams?.setting?.[0];
  const { activeCompany, user } = useAuth();

  const createItem = useLookupStore((s) => s.createItem);
  const accountTypes = useLookupStore((s) => s.accountTypes);
  const departments = useLookupStore((s) => s.departments);
  const supplierTypes = useLookupStore((s) => s.supplierTypes);
  const lookupLoading = useLookupStore((s) => s.loading);

  // Vehicles moved to the Fleet section.
  if (settingSlug === "vehicles") redirect("/fleet");

  const config = SETTING_MAP[settingSlug];

  const columns = useMemo(() => {
    if (!config) return [];
    return getLookupColumns({
      entityLabel: config.label,
    });
  }, [config]);

  if (!config) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This setting</span> doesn’t
          exist.
        </p>
        <Link
          href="/settings"
          className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to settings
        </Link>
      </div>
    );
  }

  const { key, storeKey, label } = config;
  const dataByKey = { accountTypes, departments, supplierTypes };
  const rawData = dataByKey[storeKey] || [];
  const isLoading = lookupLoading[key];
  const lower = label.toLowerCase();

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        back={{ href: "/settings", label: "Settings" }}
        eyebrow="( Settings · Lookup list )"
        lead="Manage"
        title={`${lower}s.`}
        description={
          isLoading
            ? "Loading…"
            : `${rawData.length} ${rawData.length === 1 ? "entry" : "entries"}`
        }
        actions={
          <CreateModal
            entityLabel={label}
            onCreate={(data) => {
              if (!activeCompany || !user) return Promise.resolve();
              return createItem(activeCompany, user.uid, key, data);
            }}
          />
        }
      />

      {isLoading ? (
        <div className="p-4">
          <LoadingState
            message={`Loading ${lower}s...`}
            variant="skeleton"
            rows={5}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rawData.map(({ id, name, shortForm, isSystem }) => ({
            id,
            name,
            shortForm: shortForm ?? "",
            isSystem,
          }))}
          entityLabel={label}
        />
      )}
    </div>
  );
}
