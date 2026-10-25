import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Back button above the eyebrow, labelled with the destination page. */
  back?: { href: string; label: string };
  /** Mono micro-label above the title, e.g. "( Finance · Accounts )". */
  eyebrow?: React.ReactNode;
  /** Muted lead phrase of the two-tone title. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  /** Mono line under the title (dates, counts). */
  description?: React.ReactNode;
  /** Right-hand side: a figure block and/or the single ink action. */
  actions?: React.ReactNode;
  className?: string;
};

/** Compact header strip that opens a ruled page frame. */
export function PageHeader({
  back,
  eyebrow,
  lead,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 px-4 py-4 md:px-6 md:py-5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        {back && (
          <Link
            href={back.href}
            aria-label={`Back to ${back.label}`}
            className="mb-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <ArrowLeft />
            <span className="truncate">{back.label}</span>
          </Link>
        )}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="heading truncate text-2xl leading-tight md:text-3xl">
          {lead && <span className="text-muted-foreground">{lead}</span>}{" "}
          <span className="text-foreground">{title}</span>
        </h1>
        {description && (
          <p className="font-mono text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-end gap-4">{actions}</div>
      )}
    </header>
  );
}

/** Mono-captioned figure for a header's right side, e.g. a balance. */
export function HeaderFigure({
  label,
  value,
  unit,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  tone?: "default" | "negative";
}) {
  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <span className="eyebrow">{label}</span>
      <p className="flex items-baseline gap-2">
        {unit && (
          <span className="font-mono text-xs text-muted-foreground">
            {unit}
          </span>
        )}
        <span
          className={cn(
            "font-mono text-2xl font-light tabular-nums md:text-3xl",
            tone === "negative" ? "text-destructive" : "text-foreground",
          )}
        >
          {value}
        </span>
      </p>
    </div>
  );
}
