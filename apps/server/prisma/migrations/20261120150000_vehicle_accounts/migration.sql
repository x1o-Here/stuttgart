-- New vehicles get their own ledger account, "Vehicle (<number>)".
-- Existing vehicles are not backfilled.
ALTER TABLE "accounts" ADD COLUMN "vehicle_id" TEXT;

CREATE UNIQUE INDEX "accounts_vehicle_id_key" ON "accounts"("vehicle_id");

-- Restrict: deleting a vehicle that has an account hides the vehicle instead.
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An account belongs to at most one client, supplier or vehicle.
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_single_owner";
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_single_owner"
    CHECK (num_nonnulls("client_id", "supplier_id", "vehicle_id") <= 1);
