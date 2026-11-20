-- Running number at the end of each client invoice number (26JUL_DMKT_0124 → 124),
-- unique among live invoices across all companies.
ALTER TABLE "invoices" ADD COLUMN "sequence_no" INTEGER;

UPDATE "invoices"
SET "sequence_no" = CASE
    WHEN length(substring("tax_invoice_no" FROM '(\d+)\s*$')) <= 9
        THEN substring("tax_invoice_no" FROM '(\d+)\s*$')::INTEGER
END;

-- Stop with a clear message rather than a bare index error if live invoices already share a number.
DO $$
DECLARE duplicates TEXT;
BEGIN
    SELECT string_agg(sequence_no::TEXT, ', ') INTO duplicates
    FROM (
        SELECT "sequence_no" FROM "invoices"
        WHERE "entity_status" AND "sequence_no" IS NOT NULL
        GROUP BY "sequence_no" HAVING count(*) > 1
    ) d;
    IF duplicates IS NOT NULL THEN
        RAISE EXCEPTION 'Live invoices share running numbers: %. Renumber them before applying this migration.', duplicates;
    END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_sequence_no_key" ON "invoices"("sequence_no") WHERE (entity_status);
