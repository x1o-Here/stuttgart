"use client";

import { ArrowUpRight, Building, Tags } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { useLookupStore } from "@/stores/use-lookup-store";

export default function SettingsPage() {
  const accountTypes = useLookupStore((s) => s.accountTypes);
  const departments = useLookupStore((s) => s.departments);
  const loading = useLookupStore((s) => s.loading);

  const settings = [
    {
      name: "Account types",
      description:
        "Groups for the chart of accounts, such as Bank, Cash or Client.",
      icon: Tags,
      href: "/settings/account-types",
      count: loading["account-types"] ? null : accountTypes.length,
    },
    {
      name: "Departments",
      description:
        "Cost centres every transaction is allocated to, shown by short form.",
      icon: Building,
      href: "/settings/departments",
      count: loading.departments ? null : departments.length,
    },
  ];

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        eyebrow="( Administration · Settings )"
        lead="System"
        title="settings."
        description="Lookup lists used across the ledger"
      />

      <div className="grid sm:grid-cols-2">
        {settings.map((setting, index) => (
          <Link
            key={setting.name}
            href={setting.href}
            className="group flex min-w-0 flex-col gap-6 border-b px-5 py-4 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none sm:border-r"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow normal-case tracking-normal">
                {String(index + 1).padStart(2, "0")} / {setting.name}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <setting.icon className="size-4 text-muted-foreground" />
                  {setting.name}
                </span>
                <p className="text-sm text-muted-foreground">
                  {setting.description}
                </p>
              </div>
              <p className="flex shrink-0 items-baseline gap-1.5">
                <span className="font-mono text-2xl font-light tabular-nums text-foreground">
                  {setting.count ?? "–"}
                </span>
                <span className="text-xs text-muted-foreground">entries</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
