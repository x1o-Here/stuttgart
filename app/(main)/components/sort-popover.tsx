"use client";

import { ChevronDown, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandItem } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SortPopoverProps {
  options: { label: string; column: string; direction: "asc" | "desc" }[];
  onSortChange: (column: string, direction: "asc" | "desc") => void;
}

export function SortPopover({ options, onSortChange }: SortPopoverProps) {
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
              onSelect={() =>
                onSortChange(opt.column, opt.direction as "asc" | "desc")
              }
            >
              {opt.label}
            </CommandItem>
          ))}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
