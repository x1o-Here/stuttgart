"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth, db } from "@/lib/firebase/firebase-client";

export type Company = {
  id: string;
  name: string;
};

type AuthProfile = {
  user: User;
  username: string | null;
  role: string | null;
  companies: Company[];
  activeCompany: string;
};

/** Survives React remounts for the lifetime of the JS session. */
let sessionProfile: AuthProfile | null = null;

const PUBLIC_PATHS = ["/sign-in"];

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

async function fetchAuthProfile(user: User): Promise<AuthProfile> {
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) {
    return {
      user,
      username: null,
      role: null,
      companies: [],
      activeCompany: "",
    };
  }

  const data = userDoc.data();
  const companyIds = Array.isArray(data.companies)
    ? (data.companies as string[])
    : [];

  let userCompanies: Company[] = [];
  if (companyIds.length > 0) {
    const companySnaps = await Promise.all(
      companyIds.map((companyId) => getDoc(doc(db, "companies", companyId))),
    );

    userCompanies = companySnaps
      .filter(
        (companyDoc) =>
          companyDoc.exists() && companyDoc.data()?.entityStatus !== false,
      )
      .map((companyDoc) => ({
        id: companyDoc.id,
        name: (companyDoc.data()?.name as string) || companyDoc.id,
      }));
  }

  return {
    user,
    username: data.username ?? null,
    role: data.role ?? null,
    companies: userCompanies,
    activeCompany: resolveActiveCompany(user.uid, userCompanies),
  };
}

type AuthContextType = {
  user: User | null;
  username: string | null;
  role: string | null;
  companies: Company[];
  loading: boolean;
  activeCompany: string;
  setActiveCompany: (company: string) => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  username: null,
  role: null,
  companies: [],
  loading: true,
  activeCompany: "",
  setActiveCompany: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(
    () => sessionProfile?.user ?? null,
  );
  const [username, setUsername] = useState<string | null>(
    () => sessionProfile?.username ?? null,
  );
  const [role, setRole] = useState<string | null>(
    () => sessionProfile?.role ?? null,
  );
  const [companies, setCompanies] = useState<Company[]>(
    () => sessionProfile?.companies ?? [],
  );
  const [activeCompany, setActiveCompanyState] = useState<string>(
    () => sessionProfile?.activeCompany ?? "",
  );
  const [loading, setLoading] = useState(() => !sessionProfile);

  const setActiveCompany = useCallback((companyId: string) => {
    setActiveCompanyState(companyId);
    if (sessionProfile) {
      sessionProfile = { ...sessionProfile, activeCompany: companyId };
    }
    const uid = sessionProfile?.user.uid ?? auth.currentUser?.uid;
    if (uid) {
      storeActiveCompany(uid, companyId);
    }
  }, []);

  const applyProfile = useCallback((profile: AuthProfile) => {
    sessionProfile = profile;
    setUser(profile.user);
    setUsername(profile.username);
    setRole(profile.role);
    setCompanies(profile.companies);
    setActiveCompanyState(profile.activeCompany);
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const profile = await fetchAuthProfile(currentUser);
      applyProfile(profile);
    } catch (error) {
      console.error("Error refreshing user profile:", error);
    }
  }, [applyProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        sessionProfile = null;
        setUser(null);
        setUsername(null);
        setRole(null);
        setCompanies([]);
        setActiveCompanyState("");
        setLoading(false);
        return;
      }

      // Same user already loaded this session — keep cached profile.
      if (sessionProfile?.user.uid === nextUser.uid) {
        sessionProfile = { ...sessionProfile, user: nextUser };
        setUser(nextUser);
        setUsername(sessionProfile.username);
        setRole(sessionProfile.role);
        setCompanies(sessionProfile.companies);
        setActiveCompanyState(sessionProfile.activeCompany);
        setLoading(false);
        return;
      }

      try {
        const profile = await fetchAuthProfile(nextUser);
        applyProfile(profile);
      } catch (error) {
        console.error("Error fetching user data:", error);
        sessionProfile = null;
        setUser(nextUser);
        setUsername(null);
        setRole(null);
        setCompanies([]);
        setActiveCompanyState("");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [applyProfile]);

  const value = useMemo(
    () => ({
      user,
      username,
      role,
      companies,
      loading,
      activeCompany,
      setActiveCompany,
      refreshProfile,
    }),
    [
      user,
      username,
      role,
      companies,
      loading,
      activeCompany,
      setActiveCompany,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Gate protected routes. Auth data itself lives in AuthProvider (root). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && !PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
      const search =
        typeof window !== "undefined" ? window.location.search : "";
      const nextPath = `${pathname}${search}`;
      const next =
        nextPath && nextPath !== "/"
          ? `?next=${encodeURIComponent(nextPath)}`
          : "";
      router.replace(`/sign-in${next}`);
    }
  }, [loading, user, pathname, router]);

  // Never flash the auth gate when session is already known.
  if (user || sessionProfile) {
    return children;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-screen w-screen bg-gray-50 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm">Signing you in...</p>
      </div>
    );
  }

  return null;
}

export const useAuth = () => useContext(AuthContext);
