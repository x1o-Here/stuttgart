'use client'

import { ReactNode } from "react"
import { useParams } from "next/navigation"
import { VehicleProvider } from "@/contexts/useVehicleContext"

interface VehicleLayoutProps {
    children: ReactNode
}

export default function VehicleLayout({ children }: VehicleLayoutProps) {
    const params = useParams()
    const vehicleId = params?.id as string

    if (!vehicleId) return <>{children}</> // fallback if no id

    return (
        <div className="min-h-screen">
            <VehicleProvider vehicleId={vehicleId}>
                {children}
            </VehicleProvider>
        </div>

    )
}
