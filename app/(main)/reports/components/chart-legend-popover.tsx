"use client";

import { Check, List } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type LegendItem = { id: string; label: string; color: string };

type ChartLegendPopoverProps = {
  items: LegendItem[];
  /** Currently focused series id, or "all". */
  selectedId: string;
  onSelect: (id: string) => void;
};

/**
 * Legend for charts with many series: a toolbar button that opens a
 * scrollable list. Picking an item focuses that series; "All" resets.
 */
export function ChartLegendPopover({
  items,
  selectedId,
  onSelect,
}: ChartLegendPopoverProps) {
  const [open, setOpen] = useState(false);

  const choose = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <List />
          Legend
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {items.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <span className="eyebrow">( Series · click to focus )</span>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          <li>
            <button
              type="button"
              onClick={() => choose("all")}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <span className="size-2.5 shrink-0 rounded-full border border-dashed border-muted-foreground" />
              <span className="flex-1">All accounts</span>
              {selectedId === "all" && <Check className="size-4" />}
            </button>
          </li>
          {items.map((item) => {
            const dimmed = selectedId !== "all" && selectedId !== item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    choose(selectedId === item.id ? "all" : item.id)
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                    dimmed && "text-muted-foreground",
                  )}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {selectedId === item.id && <Check className="size-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
