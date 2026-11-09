"use client";

import { ArrowUpDown, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SortOption = {
  label: string;
  column: string;
  direction: "asc" | "desc";
};

interface SortPopoverProps {
  onSortChange: (column: string, direction: "asc" | "desc") => void;
  options?: readonly SortOption[];
  /** Label of the option matching the table's initial sort, if any. */
  initialLabel?: string | null;
}

const TRANSACTION_OPTIONS: readonly SortOption[] = [
  { label: "Date · newest first", column: "date", direction: "desc" },
  { label: "Date · oldest first", column: "date", direction: "asc" },
  { label: "Amount · high to low", column: "amount", direction: "desc" },
  { label: "Amount · low to high", column: "amount", direction: "asc" },
];

/** Toolbar sort control: outline button + popover list with a check mark. */
export function SortPopover({
  onSortChange,
  options = TRANSACTION_OPTIONS,
  initialLabel = options[0]?.label ?? null,
}: SortPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialLabel);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={selected ? `Sort: ${selected}` : "Sort"}
        >
          <ArrowUpDown />
          <span className="hidden sm:inline">Sort</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="border-b px-3 py-2">
          <span className="eyebrow">( Sort by )</span>
        </div>
        <Command>
          <CommandList>
            {options.map((opt) => (
              <CommandItem
                key={opt.label}
                onSelect={() => {
                  setSelected(opt.label);
                  onSortChange(opt.column, opt.direction);
                  setOpen(false);
                }}
              >
                <span className="flex-1">{opt.label}</span>
                {selected === opt.label && <Check className="size-4" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TransactionsSortPopover({
  onSortChange,
}: Pick<SortPopoverProps, "onSortChange">) {
  return <SortPopover onSortChange={onSortChange} />;
}
