"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/firebase-client";

export type Company = {
  id: string;
  name: string;
};

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
  setActiveCompany: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<string>("");
  const router = useRouter();

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

            const companyDocs = await getDocs(query(collection(db, "companies"), where("id", "in", companyIds)));
            
            const userCompanies: Company[] = companyDocs
              .docs.filter((companyDoc) => companyDoc.exists())
              .map((companyDoc) => ({
                id: companyDoc.id,
                companyId: companyDoc.data().id,
                name: companyDoc.data().name,
              }));

            setCompanies(userCompanies);
            if (userCompanies.length > 0) {
              setActiveCompany(userCompanies[0].id);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
        setUsername(null);
        setRole(null);
        setCompanies([]);
        setActiveCompany("");
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
