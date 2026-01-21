'use client'

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { useRouter } from "next/navigation"
import { Vehicle } from "./columns"
import { SellVehicleDialog } from "./sell-vehicle-dialog"
import DeletionDialog from "./deletion-dialog"
import RevertSellVehicleDialog from "./revert-vehicle-sell-dialog"

interface ActionsDropdownProps {
    vehicle: Vehicle
}

export default function ActionsDropdownMenu({
    vehicle,
}: ActionsDropdownProps) {
    const router = useRouter();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="outline">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                    onClick={() => router.push(`/vehicle/${vehicle.id}`)}
                >
                    View vehicle
                </DropdownMenuItem>

                {vehicle.vehicleStatus === "active" ? (
                    <SellVehicleDialog vehicle={vehicle} />
                ) : (
                    <RevertSellVehicleDialog vehicle={vehicle} />
                )}

                <DropdownMenuSeparator />

                <DeletionDialog vehicle={vehicle} />
            </DropdownMenuContent>
        </DropdownMenu>
    )
}