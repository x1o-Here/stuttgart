/**
 * Custom reports for the screens; API or Firestore by the "vat-reports" flag.
 */
import { api } from "@/lib/api-client";
import { usesApi } from "../flags";
import { dataChanged } from "../live";
import * as firestore from "./firestore";

type Args<F extends (...args: never[]) => unknown> = Parameters<F>[0];

export async function createReport(p: Args<typeof firestore.createReport>) {
  if (!usesApi("vat-reports")) return firestore.createReport(p);
  await api.post(`/companies/${p.activeCompany}/reports`, {
    name: p.data.name.trim(),
    description: p.data.description?.trim() || "",
    fromDate: p.data.fromDate ?? null,
    toDate: p.data.toDate ?? null,
    accountIds: p.data.accountIds,
  });
  dataChanged();
}

export async function saveReportFilters(
  p: Args<typeof firestore.saveReportFilters>,
) {
  if (!usesApi("vat-reports")) return firestore.saveReportFilters(p);
  await api.patch(
    `/companies/${p.activeCompany}/reports/${p.reportId}/filters`,
    {
      filters: p.nextFilters,
    },
  );
  dataChanged();
}
