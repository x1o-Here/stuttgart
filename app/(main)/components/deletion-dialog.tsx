'use client'

import { useState, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import axios from "axios"
import { Vehicle } from "./columns"

interface ConfirmationDialogProps {
    vehicle: Vehicle
    title?: string
    description?: string
}

export default function DeletionDialog({
    vehicle,
    title = "Are you sure?",
    description = "This action cannot be undone.",
}: ConfirmationDialogProps) {
    const [open, setOpen] = useState(false)

    const handleConfirm = async () => {
        try {
            const res = await axios.put(`/api/vehicle/${vehicle.id}/delete`)
            if (res.data?.success) {
                console.log("Vehicle deleted successfully")
            }
        } catch (err) {
            console.error("Failed to delete vehicle", err)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onSelect={(e) => {
                        e.preventDefault();
                        setOpen(true);
                    }}
                >
                    Delete vehicle
                </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <p className="text-sm text-gray-600 mt-2">{description}</p>
                </DialogHeader>
                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={async () => {
                            await handleConfirm()
                            setOpen(false)
                        }}
                    >
                        Yes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
