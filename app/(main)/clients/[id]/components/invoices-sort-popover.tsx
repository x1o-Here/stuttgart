"use client";

import { SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandItem } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface InvoicesSortPopoverProps {
  onSortChange: (column: string, direction: "asc" | "desc") => void;
}

export function InvoicesSortPopover({
  onSortChange,
}: InvoicesSortPopoverProps) {
  const options = [
    { label: "Date ↑", column: "date", direction: "asc" as const },
    { label: "Date ↓", column: "date", direction: "desc" as const },
    {
      label: "Total Amount ↑",
      column: "totalAmount",
      direction: "asc" as const,
    },
    {
      label: "Total Amount ↓",
      column: "totalAmount",
      direction: "desc" as const,
    },
    {
      label: "Outstanding ↑",
      column: "outstandingAmount",
      direction: "asc" as const,
    },
    {
      label: "Outstanding ↓",
      column: "outstandingAmount",
      direction: "desc" as const,
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <SortAsc />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0">
        <Command>
          {options.map((opt) => (
            <CommandItem
              key={opt.label}
              onSelect={() => onSortChange(opt.column, opt.direction)}
            >
              {opt.label}
            </CommandItem>
          ))}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
