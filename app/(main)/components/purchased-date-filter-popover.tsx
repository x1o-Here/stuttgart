'use client'

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import CalendarPopover from "../vehicle/[id]/components/calendar-popover";
import { Filter } from "lucide-react";

interface PurchasedDateFilterPopoverProps {
    onDateChange: (from: Date | undefined, to: Date | undefined) => void;
}

export function PurchasedDateFilterPopover({ onDateChange }: PurchasedDateFilterPopoverProps) {
    const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
    const [toDate, setToDate] = useState<Date | undefined>(undefined);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                >
                    <Filter className="mr-2 h-4 w-4" />
                    Purchased Date
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">From</label>
                    <CalendarPopover
                        value={fromDate}
                        onChange={setFromDate}
                        label="From"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">To</label>
                    <CalendarPopover
                        value={toDate}
                        onChange={setToDate}
                        label="To"
                    />
                </div>

                <Button
                    className="mt-2"
                    onClick={() => onDateChange(fromDate, toDate)}
                >
                    Apply
                </Button>
            </PopoverContent>
        </Popover>
    );
}
