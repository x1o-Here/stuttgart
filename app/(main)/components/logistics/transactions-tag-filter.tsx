"use client";

import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { TAG_OPTIONS } from "@/lib/helpers/transaction-tags";

import { useState, useEffect, useRef } from "react";

interface TransactionsTagFilterProps<TData> {
    table: Table<TData>;
}

export function TransactionsTagFilter<TData>({ table }: TransactionsTagFilterProps<TData>) {
    const tagsColumn = table.getColumn("tags");
    const hasInitialized = useRef(false);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
        (tagsColumn?.getFilterValue() as string[]) || ["active"]
    );

    useEffect(() => {
        if (!tagsColumn || hasInitialized.current) return;
        hasInitialized.current = true;

        const filterValue = tagsColumn.getFilterValue() as string[] | undefined;
        if (!filterValue || filterValue.length === 0) {
            tagsColumn.setFilterValue(["active"]);
            setSelectedStatuses(["active"]);
            return;
        }

        setSelectedStatuses(filterValue);
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
                {TAG_OPTIONS.map((status) => {
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
