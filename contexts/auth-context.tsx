"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { auth, db } from "@/lib/firebase/firebase-client";

export type Company = {
  id: string;
  name: string;
};

function getActiveCompanyStorageKey(uid: string) {
  return `stuttgart:activeCompany:${uid}`;
}

function getStoredActiveCompany(uid: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(getActiveCompanyStorageKey(uid));
}

function storeActiveCompany(uid: string, companyId: string) {
  localStorage.setItem(getActiveCompanyStorageKey(uid), companyId);
}

function resolveActiveCompany(uid: string, userCompanies: Company[]): string {
  if (userCompanies.length === 0) return "";

  const storedCompanyId = getStoredActiveCompany(uid);
  const accessibleCompanyIds = userCompanies.map((company) => company.id);

  if (storedCompanyId && accessibleCompanyIds.includes(storedCompanyId)) {
    return storedCompanyId;
  }

  const defaultCompanyId = userCompanies[0].id;
  storeActiveCompany(uid, defaultCompanyId);
  return defaultCompanyId;
}

type AuthContextType = {
  user: User | null;
  username: string | null;
  role: string | null;
  companies: Company[];
  loading: boolean;
  activeCompany: string;
  setActiveCompany: (company: string) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  username: null,
  role: null,
  companies: [],
  loading: true,
  activeCompany: "",
  setActiveCompany: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompanyState] = useState<string>("");
  const router = useRouter();

  const setActiveCompany = useCallback(
    (companyId: string) => {
      setActiveCompanyState(companyId);
      if (user?.uid) {
        storeActiveCompany(user.uid, companyId);
      }
    },
    [user?.uid],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUsername(data.username);
            setRole(data.role);

            const companyIds = Array.isArray(data.companies)
              ? (data.companies as string[])
              : [];

            const companyDocs = await getDocs(
              query(collection(db, "companies"), where("id", "in", companyIds)),
            );

            const userCompanies: Company[] = companyDocs.docs
              .filter((companyDoc) => companyDoc.exists())
              .map((companyDoc) => ({
                id: companyDoc.id,
                name: companyDoc.data().name as string,
              }));

            setCompanies(userCompanies);
            setActiveCompanyState(
              resolveActiveCompany(user.uid, userCompanies),
            );
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
        setUsername(null);
        setRole(null);
        setCompanies([]);
        setActiveCompanyState("");
        router.push("/sign-in");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Don't render children if not authenticated (redirect happened)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        username,
        role,
        companies,
        loading,
        activeCompany,
        setActiveCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
