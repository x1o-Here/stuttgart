"use client";

import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { Table } from "@tanstack/react-table";

import { useState, useEffect } from "react";

interface TransactionsTagFilterProps<TData> {
    table: Table<TData>;
}

export function TransactionsTagFilter<TData>({ table }: TransactionsTagFilterProps<TData>) {
    const tagsColumn = table.getColumn("tags");
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
        (tagsColumn?.getFilterValue() as string[]) || []
    );

    // Sync with table state changes (e.g. from clear filters)
    useEffect(() => {
        setSelectedStatuses((tagsColumn?.getFilterValue() as string[]) || []);
    }, [tagsColumn]);

    let buttonLabel = "All";
    if (selectedStatuses.length === 1) {
        buttonLabel = selectedStatuses[0].charAt(0).toUpperCase() + selectedStatuses[0].slice(1);
    } else if (selectedStatuses.length > 1) {
        buttonLabel = "Displaying";
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="items-center gap-2">
                    <Filter className="h-4 w-4" />
                    {buttonLabel}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {["active", "deleted", "corrected", "reversal"].map((status) => {
                    const isSelected = selectedStatuses.includes(status);

                    return (
                        <DropdownMenuCheckboxItem
                            key={status}
                            checked={isSelected}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={(checked) => {
                                const next = checked
                                    ? [...selectedStatuses, status]
                                    : selectedStatuses.filter(s => s !== status);
                                
                                setSelectedStatuses(next);
                                tagsColumn?.setFilterValue(next.length ? next : undefined);
                            }}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </DropdownMenuCheckboxItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
