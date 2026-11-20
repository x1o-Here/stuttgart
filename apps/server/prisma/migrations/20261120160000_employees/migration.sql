-- Employees. Each one gets its own ledger account "EMP_<name>" under the
-- system "Employee" account type; the company also gets one EPF and one ETF
-- account (created with the first employee).
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "entity_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- Employee numbers are unique per company among live (not deleted) employees.
CREATE UNIQUE INDEX "employees_company_id_employee_no_key" ON "employees"("company_id", "employee_no") WHERE (entity_status);

ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An employee's own ledger account.
ALTER TABLE "accounts" ADD COLUMN "employee_id" TEXT;

CREATE UNIQUE INDEX "accounts_employee_id_key" ON "accounts"("employee_id");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An account belongs to at most one client, supplier, vehicle or employee.
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_single_owner";
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_single_owner"
    CHECK (num_nonnulls("client_id", "supplier_id", "vehicle_id", "employee_id") <= 1);
