-- Client and supplier invoices post a ledger entry when issued. Existing
-- invoices are not backfilled: their transaction_id stays NULL.
ALTER TABLE "invoices" ADD COLUMN "transaction_id" TEXT;
ALTER TABLE "supplier_invoices" ADD COLUMN "transaction_id" TEXT;

CREATE UNIQUE INDEX "invoices_transaction_id_key" ON "invoices"("transaction_id");
CREATE UNIQUE INDEX "supplier_invoices_transaction_id_key" ON "supplier_invoices"("transaction_id");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
