import { Wrench } from "lucide-react";

/**
 * Shown instead of the whole app while NEXT_PUBLIC_MAINTENANCE_MODE=1
 * (the cutover window). The server refuses writes at the same time
 * (MAINTENANCE_MODE=1), so even an old open tab can't change anything.
 */
export function MaintenanceScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-card p-6 text-center font-sans">
      <Wrench className="size-8 text-muted-foreground" strokeWidth={1.5} />
      <span className="eyebrow">( Scheduled maintenance )</span>
      <h1 className="heading text-3xl">
        <span className="text-muted-foreground">Stuttgart is</span> being
        upgraded.
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        We’re moving your data to a faster system. Nothing is lost — please come
        back in a little while.
      </p>
    </main>
  );
}

export const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "1";
