import type * as React from "react";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Classes for a DialogContent that hosts ruled header / sections / footer. */
export const ruledDialogContentClass =
  "max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl";

type RuledDialogHeaderProps = {
  /** Mono label above the title, e.g. "( New entry · Ledger )". */
  eyebrow: React.ReactNode;
  /** Muted lead phrase of the two-tone title. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
};

export function RuledDialogHeader({
  eyebrow,
  lead,
  title,
  description,
}: RuledDialogHeaderProps) {
  return (
    <DialogHeader className="gap-3 border-b px-6 pt-6 pb-5 text-left">
      <span className="eyebrow">{eyebrow}</span>
      <DialogTitle className="heading text-2xl font-normal">
        {lead && <span className="text-muted-foreground">{lead}</span>} {title}
      </DialogTitle>
      {description && <DialogDescription>{description}</DialogDescription>}
    </DialogHeader>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="eyebrow normal-case tracking-normal">{children}</span>
  );
}

type RuledDialogSectionProps = {
  /** Numbered caption, e.g. "01 / Details". */
  label: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function RuledDialogSection({
  label,
  className,
  children,
}: RuledDialogSectionProps) {
  return (
    <section
      className={cn(
        "grid gap-4 border-b px-6 py-5 last:border-b-0 sm:grid-cols-2",
        className,
      )}
    >
      <div className="sm:col-span-2">
        <SectionLabel>{label}</SectionLabel>
      </div>
      {children}
    </section>
  );
}

type RuledDialogFooterProps = {
  /** Mono summary shown on the left, e.g. the amount being recorded. */
  summary?: React.ReactNode;
  children: React.ReactNode;
};

export function RuledDialogFooter({
  summary,
  children,
}: RuledDialogFooterProps) {
  return (
    <DialogFooter className="flex-col gap-3 border-t bg-surface-muted px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 truncate font-mono text-xs tabular-nums text-muted-foreground">
        {summary}
      </p>
      <div className="flex gap-2 sm:shrink-0">{children}</div>
    </DialogFooter>
  );
}
