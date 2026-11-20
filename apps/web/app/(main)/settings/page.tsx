"use client";

import {
  ArrowUpRight,
  Building,
  Building2,
  Factory,
  type LucideIcon,
  Tags,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useActiveCompany } from "@/hooks/use-active-company";
import { useLookupStore } from "@/stores/use-lookup-store";

type SettingCard = {
  name: string;
  description: string;
  icon: LucideIcon;
  href: string;
  /** Right-hand figure, e.g. an entry count. */
  aside: ReactNode;
};

function SettingsGroup({
  title,
  description,
  cards,
}: {
  title: string;
  description: string;
  cards: SettingCard[];
}) {
  return (
    <section className="flex flex-col">
      <div className="flex flex-col gap-1 border-b px-5 py-3">
        <span className="eyebrow normal-case tracking-normal">{title}</span>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <Link
            key={card.name}
            href={card.href}
            className="group flex min-w-0 flex-col gap-6 border-b px-5 py-4 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none sm:border-r"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow normal-case tracking-normal">
                {String(index + 1).padStart(2, "0")} / {card.name}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </div>
            <div className="flex items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <card.icon className="size-4 text-muted-foreground" />
                  {card.name}
                </span>
                <p className="text-sm text-muted-foreground">
                  {card.description}
                </p>
              </div>
              {card.aside}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EntryCount({ count }: { count: number | null }) {
  return (
    <p className="flex shrink-0 items-baseline gap-1.5">
      <span className="font-mono text-2xl font-light tabular-nums text-foreground">
        {count ?? "–"}
      </span>
      <span className="text-xs text-muted-foreground">entries</span>
    </p>
  );
}

export default function SettingsPage() {
  const accountTypes = useLookupStore((s) => s.accountTypes);
  const departments = useLookupStore((s) => s.departments);
  const supplierTypes = useLookupStore((s) => s.supplierTypes);
  const loading = useLookupStore((s) => s.loading);
  const {
    company,
    loading: companyLoading,
    vatRegistered,
  } = useActiveCompany();

  const organization: SettingCard[] = [
    {
      name: "Organization",
      description: `${
        companyLoading ? "Loading…" : company?.name || "Active company"
      }: company details printed on invoices, and VAT registration.`,
      icon: Building2,
      href: "/settings/organization",
      aside: (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {companyLoading ? "–" : vatRegistered ? "VAT registered" : "No VAT"}
        </span>
      ),
    },
  ];

  const lookupLists: SettingCard[] = [
    {
      name: "Account types",
      description:
        "Groups for the chart of accounts, such as Bank, Cash or Client.",
      icon: Tags,
      href: "/settings/account-types",
      aside: (
        <EntryCount
          count={loading["account-types"] ? null : accountTypes.length}
        />
      ),
    },
    {
      name: "Departments",
      description:
        "Cost centres every transaction is allocated to, shown by short form.",
      icon: Building,
      href: "/settings/departments",
      aside: (
        <EntryCount count={loading.departments ? null : departments.length} />
      ),
    },
    {
      name: "Supplier types",
      description:
        "Categories for suppliers, such as Fuel, Spare parts or Tyres.",
      icon: Factory,
      href: "/settings/supplier-types",
      aside: (
        <EntryCount
          count={loading["supplier-types"] ? null : supplierTypes.length}
        />
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-card font-sans">
      <PageHeader
        eyebrow="( Administration · Settings )"
        lead="System"
        title="settings."
        description="Organization options and lookup lists"
        className="border-b"
      />
      <SettingsGroup
        title="Organization"
        description="Settings for the active company."
        cards={organization}
      />
      <SettingsGroup
        title="Lookup lists"
        description="Options offered in the pickers across the app."
        cards={lookupLists}
      />
    </div>
  );
}
