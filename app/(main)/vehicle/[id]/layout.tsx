"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { VehicleProvider } from "@/contexts/useVehicleContext";

interface VehicleLayoutProps {
  children: ReactNode;
}

export default function VehicleLayout({ children }: VehicleLayoutProps) {
  const params = useParams();
  const vehicleId = params?.id as string;

  if (!vehicleId) return <>{children}</>; // fallback if no id

  return (
    <div className="min-h-screen">
      <VehicleProvider vehicleId={vehicleId}>{children}</VehicleProvider>
    </div>
  );
}
