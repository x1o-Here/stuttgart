import { useVehicleContext } from "@/contexts/useVehicleContext";
import MaintenanceTable from "./maintenance-table";

export default function MaintenanceContent() {
  const { quotations } = useVehicleContext();
  return (
    <div className="p-4">
      <MaintenanceTable data={quotations} />
    </div>
  );
}
