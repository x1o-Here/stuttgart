"use client";

import { Check, Plus, Truck } from "lucide-react";
import { useState } from "react";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import {
  assignPart,
  InventoryError,
  type SparePart,
} from "@/lib/inventory/spare-parts";
import { cn } from "@/lib/utils";
import { useLookupStore } from "@/stores/use-lookup-store";
import VehicleFormDialog from "../../fleet/components/vehicle-form-dialog";

/** Assigns an in-stock part to one fleet vehicle. */
export function AssignPartDialog({ part }: { part: SparePart }) {
  const { user, activeCompany } = useAuth();
  const vehicles = useLookupStore((s) => s.vehicles);
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [addingVehicle, setAddingVehicle] = useState(false);

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  async function handleAssign() {
    if (!activeCompany || !user || !vehicle) return;
    setSaving(true);
    setError(null);
    try {
      await assignPart(activeCompany, user.uid, part.id, {
        id: vehicle.id,
        name: vehicle.name,
      });
      setOpen(false);
    } catch (err) {
      console.error("Failed to assign spare part", err);
      setError(
        err instanceof InventoryError
          ? err.message
          : "Couldn’t assign the part. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
        if (next) {
          setVehicleId(null);
          setError(null);
          setQuery("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Truck />
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
        <RuledDialogHeader
          eyebrow={`( Inventory · ${part.partId} )`}
          lead="Assign to a"
          title="vehicle."
          description={part.description}
        />
        <RuledDialogSection label="01 / Vehicle">
          <div className="sm:col-span-2">
            <Command className="rounded-md border">
              <CommandInput
                placeholder="Search vehicle number"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList className="max-h-56">
                <CommandEmpty className="flex flex-col items-center gap-2 py-4 text-sm">
                  <span className="text-muted-foreground">
                    {query.trim() ? (
                      <>
                        No vehicle number{" "}
                        <span className="font-mono text-foreground">
                          {query.trim()}
                        </span>
                        .
                      </>
                    ) : vehicles.length ? (
                      "No vehicle matches."
                    ) : (
                      "No vehicles in the fleet yet."
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setAddingVehicle(true)}
                  >
                    <Plus />
                    {query.trim()
                      ? `Add vehicle ${query.trim()}`
                      : "Add vehicle"}
                  </Button>
                </CommandEmpty>
                {vehicles.map((v) => (
                  <CommandItem
                    key={v.id}
                    value={`${v.name} ${v.description ?? ""}`}
                    onSelect={() => setVehicleId(v.id)}
                    className={cn(vehicleId === v.id && "bg-accent")}
                  >
                    <span className="font-mono">{v.name}</span>
                    {v.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {v.description}
                      </span>
                    ) : null}
                    {vehicleId === v.id && <Check className="ml-auto size-4" />}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
            <VehicleFormDialog
              open={addingVehicle}
              onOpenChange={setAddingVehicle}
              initialName={query.trim().toUpperCase()}
              onSaved={(name) => {
                // The store has refreshed by now; select the new vehicle.
                const added = useLookupStore
                  .getState()
                  .vehicles.find((v) => v.name === name);
                if (added) setVehicleId(added.id);
                setQuery("");
              }}
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive sm:col-span-2"
            >
              {error}
            </p>
          ) : null}
        </RuledDialogSection>
        <RuledDialogFooter
          summary={
            vehicle
              ? `Assigns ${part.partId} to ${vehicle.name}`
              : "Pick a vehicle"
          }
        >
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={saving || !vehicle}
            onClick={() => void handleAssign()}
          >
            {saving ? "Assigning…" : "Assign part"}
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
