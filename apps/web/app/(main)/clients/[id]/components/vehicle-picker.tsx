"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import VehicleFormDialog from "../../../fleet/components/vehicle-form-dialog";

/** "WP-1234", "wp 1234" and "WP1234" all match each other. */
function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type VehiclePickerProps = {
  value: string;
  onChange: (name: string) => void;
  vehicles: { id: string; name: string; description?: string }[];
  placeholder?: string;
};

/**
 * Type-to-search vehicle number. When nothing matches, says so and offers
 * to register the typed number as a new vehicle, then selects it.
 */
export function VehiclePicker({
  value,
  onChange,
  vehicles,
  placeholder = "Vehicle",
}: VehiclePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const matches = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return vehicles;
    return vehicles.filter(
      (vehicle) =>
        normalize(vehicle.name).includes(needle) ||
        normalize(vehicle.description ?? "").includes(needle),
    );
  }, [query, vehicles]);

  const typed = query.trim();

  function select(name: string) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between px-3 font-normal"
          >
            <span
              className={cn(
                "truncate",
                value ? "font-mono" : "text-muted-foreground",
              )}
            >
              {value || placeholder}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type vehicle number"
              value={query}
              onValueChange={setQuery}
              className="font-mono"
            />
            <CommandList className="max-h-60">
              {matches.map((vehicle) => (
                <CommandItem
                  key={vehicle.id}
                  value={vehicle.id}
                  onSelect={() => select(vehicle.name)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      vehicle.name === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono">{vehicle.name}</span>
                    {vehicle.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {vehicle.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
            {matches.length === 0 ? (
              <div className="flex flex-col gap-2 p-3 text-sm">
                <p className="text-muted-foreground">
                  {typed ? (
                    <>
                      No vehicle number{" "}
                      <span className="font-mono text-foreground">{typed}</span>
                      .
                    </>
                  ) : (
                    "No vehicles in the fleet yet."
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setAdding(true);
                  }}
                >
                  <Plus />
                  {typed ? `Add vehicle ${typed}` : "Add vehicle"}
                </Button>
              </div>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>

      <VehicleFormDialog
        open={adding}
        onOpenChange={(next) => {
          setAdding(next);
          if (!next) setQuery("");
        }}
        initialName={typed.toUpperCase()}
        onSaved={(name) => select(name)}
      />
    </>
  );
}
