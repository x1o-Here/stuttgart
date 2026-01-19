'use client'

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandItem } from "@/components/ui/command";
import { ChevronDown, SortAsc } from "lucide-react";

interface SortPopoverProps {
    onSortChange: (column: string, direction: "asc" | "desc") => void;
}

export function SortPopover({ onSortChange }: SortPopoverProps) {
    const options = [
        { label: "Purchased Date ↑", column: "purchasedDate", direction: "asc" },
        { label: "Purchased Date ↓", column: "purchasedDate", direction: "desc" },
        { label: "Vehicle No ↑", column: "vehicleNo", direction: "asc" },
        { label: "Vehicle No ↓", column: "vehicleNo", direction: "desc" },
        { label: "Selling Price ↑", column: "sPrice", direction: "asc" },
        { label: "Selling Price ↓", column: "sPrice", direction: "desc" },
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
