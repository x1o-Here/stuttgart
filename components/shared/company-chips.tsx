import { cn } from "@/lib/utils";

type CompanyChipsProps = {
  companies: { id: string; name: string }[];
  /** Highlights this company (e.g. the one currently active). */
  activeId?: string;
  /** Show at most this many chips, then "+N". */
  max?: number;
  className?: string;
};

/** Companies as small 2px-corner chips; the active one is brand-tinted. */
export function CompanyChips({
  companies,
  activeId,
  max,
  className,
}: CompanyChipsProps) {
  if (companies.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }

  const shown = max ? companies.slice(0, max) : companies;
  const hidden = companies.length - shown.length;

  return (
    <span className={cn("flex min-w-0 flex-wrap gap-1", className)}>
      {shown.map((company) => {
        const active = company.id === activeId;
        return (
          <span
            key={company.id}
            title={active ? `${company.name} (active)` : company.name}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium",
              active
                ? "bg-brand-soft text-brand"
                : "bg-surface-muted text-muted-foreground ring-1 ring-inset ring-border",
            )}
          >
            {active && (
              <span className="size-1.5 shrink-0 rounded-full bg-current" />
            )}
            <span className="truncate">{company.name}</span>
          </span>
        );
      })}
      {hidden > 0 && (
        <span
          className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
          title={companies
            .slice(shown.length)
            .map((c) => c.name)
            .join(", ")}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
}
