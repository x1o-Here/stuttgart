import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase-client";

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
    companiesCachePromise = getDocs(collection(db, "companies"))
      .then((companySnapshot) => {
        companiesCache = companySnapshot.docs
          .filter((companyDoc) => companyDoc.data().entityStatus !== false)
          .map((companyDoc) => ({
            id: companyDoc.id,
            name: (companyDoc.data().name as string) ?? companyDoc.id,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return companiesCache;
      })
      .catch((error) => {
        companiesCachePromise = null;
        throw error;
      });
  }
  return companiesCachePromise;
}

export function invalidateCompaniesCache() {
  companiesCache = null;
  companiesCachePromise = null;
}
