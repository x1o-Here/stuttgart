"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { type CollectionKey, useLookupStore } from "@/stores/use-lookup-store";
import { LoadingState } from "@/components/shared/loading-state";
import { getLookupColumns } from "./components/columns/lookup-columns";
import { DataTable } from "./components/data-table";

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
    storeKey: "accountTypes" | "vehicles" | "departments";
    label: string;
  }
> = {
  "account-types": {
    key: "account-types",
    storeKey: "accountTypes",
    label: "Account Type",
  },
  vehicles: {
    key: "vehicles",
    storeKey: "vehicles",
    label: "Vehicle",
  },
  departments: {
    key: "departments",
    storeKey: "departments",
    label: "Department",
  },
};

export default function SettingPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const settingSlug = resolvedParams?.setting?.[0];
  const { activeCompany, user } = useAuth();

  const createItem = useLookupStore((s) => s.createItem);
  const accountTypes = useLookupStore((s) => s.accountTypes);
  const vehicles = useLookupStore((s) => s.vehicles);
  const departments = useLookupStore((s) => s.departments);
  const lookupLoading = useLookupStore((s) => s.loading);

  const config = SETTING_MAP[settingSlug];

  const columns = useMemo(() => {
    if (!config) return [];
    return getLookupColumns({
      entityLabel: config.label,
    });
  }, [config]);

  if (!config) {
    return (
      <div className="min-h-screen h-full p-4 flex flex-col items-center justify-center font-sans">
        <p className="text-lg font-semibold mb-4">Setting route not found</p>
        <Button onClick={() => router.push("/settings")}>
          Go back to settings
        </Button>
      </div>
    );
  }

  const { key, storeKey, label } = config;
  const dataByKey = { accountTypes, vehicles, departments };
  const rawData = dataByKey[storeKey] || [];
  const isLoading = lookupLoading[key];

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full flex flex-col items-start gap-4 p-4 bg-zinc-50 rounded-lg overflow-y-auto">
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="cursor-pointer hover:bg-gray-100 w-fit px-1"
            onClick={() => router.back()}
          >
            <ChevronLeft />
            Back
          </Button>
          <h1 className="text-2xl font-bold mb-4">{label}s</h1>
        </div>

        <div className="w-full p-4 rounded-md bg-white">
          {isLoading ? (
            <LoadingState
              message={`Loading ${label.toLowerCase()}s...`}
              variant="skeleton"
              rows={5}
            />
          ) : (
            <DataTable
              columns={columns}
              data={rawData.map(({ id, name, shortForm }) => ({
                id,
                name,
                shortForm: shortForm ?? "",
              }))}
              entityLabel={label}
              onCreate={(data) => {
                if (!activeCompany || !user) return Promise.resolve();
                return createItem(activeCompany, user.uid, key, data);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
