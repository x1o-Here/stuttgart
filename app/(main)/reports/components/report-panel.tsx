import type * as React from "react";
import { cn } from "@/lib/utils";

type ReportPanelProps = {
  /** Numbered caption, e.g. "02 / Month-end balances". */
  label: React.ReactNode;
  /** Muted mono line under the caption. */
  caption?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Body classes; defaults to padded. Pass "p-0" for edge-to-edge tables. */
  bodyClassName?: string;
  children: React.ReactNode;
};

/** A ruled cell of the reports grid: caption row + body, no card chrome. */
export function ReportPanel({
  label,
  caption,
  actions,
  className,
  bodyClassName,
  children,
}: ReportPanelProps) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-card",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="eyebrow normal-case tracking-normal">{label}</h3>
          {caption && (
            <p className="truncate text-xs text-muted-foreground">{caption}</p>
          )}
        </div>
        {actions}
      </div>
      <div
        className={cn("flex min-h-0 flex-1 flex-col px-5 pb-4", bodyClassName)}
      >
        {children}
      </div>
    </section>
  );
}

/** Mono table header classes for compact report tables. */
export const reportTh =
  "h-9 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:pl-5 last:pr-5";
export const reportTd = "py-2.5 first:pl-5 last:pr-5";
