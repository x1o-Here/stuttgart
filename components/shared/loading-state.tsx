"use client";

import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  message?: string;
  className?: string;
  /** compact = inline row; page = centered block; bar = thin progress strip */
  variant?: "page" | "compact" | "bar" | "skeleton";
  rows?: number;
};

export function LoadingState({
  message = "Loading...",
  className,
  variant = "page",
  rows = 5,
}: LoadingStateProps) {
  if (variant === "bar") {
    return (
      <div className={cn("w-full space-y-2", className)}>
        <div className="h-0.5 w-full overflow-hidden bg-border">
          <div className="h-full w-1/3 animate-[loading-bar_1.1s_linear_infinite] bg-brand" />
        </div>
        {message ? <p className="eyebrow">{message}</p> : null}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={cn("flex w-full flex-col gap-2", className)}>
        {message ? (
          <p className="eyebrow mb-1 flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" />
            {message}
          </p>
        ) : null}
        {Array.from({ length: rows }, (_, i) => `skeleton-row-${i}`).map(
          (key) => (
            <Skeleton key={key} className="h-9 w-full rounded-md" />
          ),
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center",
          className,
        )}
      >
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span className="eyebrow">{message}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="eyebrow">{message}</p>
    </div>
  );
}

type SubmitButtonLabelProps = {
  pending: boolean;
  idleLabel: string;
  pendingLabel?: string;
};

export function submitLabel({
  pending,
  idleLabel,
  pendingLabel = "Saving...",
}: SubmitButtonLabelProps) {
  return pending ? pendingLabel : idleLabel;
}
