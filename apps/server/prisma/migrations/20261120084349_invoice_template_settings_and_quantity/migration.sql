-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "quantity" DECIMAL(14,4) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "invoice_templates" ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';
