import { companyOptions } from "@/lib/data/identity";

export type CompanyOption = {
  id: string;
  name: string;
};

let companiesCache: CompanyOption[] | null = null;
let companiesCachePromise: Promise<CompanyOption[]> | null = null;

/** Active companies for assignment UI (not membership-scoped). */
export async function getAllCompanies(): Promise<CompanyOption[]> {
  if (companiesCache) return companiesCache;
  if (!companiesCachePromise) {
    companiesCachePromise = loadCompanies()
      .then((options) => {
        companiesCache = options;
        return options;
      })
      .catch((error) => {
        companiesCachePromise = null;
        throw error;
      });
  }
  return companiesCachePromise;
}

function loadCompanies(): Promise<CompanyOption[]> {
  return companyOptions();
}

export function invalidateCompaniesCache() {
  companiesCache = null;
  companiesCachePromise = null;
}
