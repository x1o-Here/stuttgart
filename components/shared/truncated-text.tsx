"use client";

import type * as React from "react";
import { useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TruncatedTextProps = {
  children?: React.ReactNode;
  /** Tooltip content; defaults to children. */
  tooltip?: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
};

function isEmpty(node: React.ReactNode) {
  return (
    node === null ||
    node === undefined ||
    node === false ||
    (typeof node === "string" && node.trim() === "")
  );
}

/**
 * Single-line text that truncates with an ellipsis and shows the full
 * value in a tooltip on hover — only when the text is actually cut off.
 */
export function TruncatedText({
  children,
  tooltip,
  className,
  side = "top",
}: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const content = isEmpty(children) ? "—" : children;

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        const el = ref.current;
        setOpen(next && !!el && el.scrollWidth > el.clientWidth);
      }}
    >
      <TooltipTrigger asChild>
        <span ref={ref} className={cn("block min-w-0 truncate", className)}>
          {content}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs break-words">
        {tooltip ?? content}
      </TooltipContent>
    </Tooltip>
  );
}
