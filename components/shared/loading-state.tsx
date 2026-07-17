"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-[loading-bar_1.1s_linear_infinite] rounded-full bg-primary" />
        </div>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={cn("w-full space-y-3", className)}>
        {message ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {message}
          </p>
        ) : null}
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
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
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>{message}</span>
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
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{message}</p>
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
