'use client'

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandItem } from "@/components/ui/command";
import { SortAsc } from "lucide-react";

interface SortPopoverProps {
    onSortChange: (column: string, direction: "asc" | "desc") => void;
}

export function TransactionsSortPopover({ onSortChange }: SortPopoverProps) {
    const options = [
        { label: "Date ↑", column: "date", direction: "asc" },
        { label: "Date ↓", column: "date", direction: "desc" },
        { label: "Amount ↑", column: "amount", direction: "asc" },
        { label: "Amount ↓", column: "amount", direction: "desc" },
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                >
                    <SortAsc />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0">
                <Command>
                    {options.map((opt) => (
                        <CommandItem
                            key={opt.label}
                            onSelect={() => onSortChange(opt.column, opt.direction as "asc" | "desc")}
                        >
                            {opt.label}
                        </CommandItem>
                    ))}
                </Command>
            </PopoverContent>
        </Popover>
    );
}
