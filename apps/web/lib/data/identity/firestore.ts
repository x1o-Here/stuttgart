/**
 * Profile, users, companies and audit log on Firestore — the code that used
 * to live in the components, moved here unchanged. Deleted at the cutover.
 */

import axios from "axios";
import { type FirebaseApp, getApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { type CompanyRecord, mapCompanyDoc } from "@/lib/companies/types";
import { auth, db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";
import type {
  AuditLogEntry,
  CompanyFields,
  ProfileData,
  UserRow,
} from "./types";

// ── Reads ───────────────────────────────────────────────────────────────

/** users/{uid} plus its active companies; null when there is no profile doc. */
export async function loadProfile(user: User): Promise<ProfileData | null> {
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();

  // Removed accounts keep their doc for audit history but lose access.
  if (data.entityStatus === false) {
    await signOut(auth);
    throw new Error("This account has been removed.");
  }

  const companyIds = Array.isArray(data.companies)
    ? (data.companies as string[])
    : [];
  let companies: { id: string; name: string }[] = [];
  if (companyIds.length > 0) {
    const companySnaps = await Promise.all(
      companyIds.map((companyId) => getDoc(doc(db, "companies", companyId))),
    );
    companies = companySnaps
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
    username: data.username ?? null,
    role: data.role ?? null,
    companies,
  };
}

export async function hasProfile(uid: string): Promise<boolean> {
  return (await getDoc(doc(db, "users", uid))).exists();
}

export async function listUsers(): Promise<UserRow[]> {
  const snapshot = await getDocs(
    query(collection(db, "users"), orderBy("createdAt", "desc")),
  );
  return snapshot.docs.map((userDoc) => {
    const data = userDoc.data();
    return {
      id: userDoc.id,
      username: data.username || "N/A",
      email: data.email || "N/A",
      removed: data.entityStatus === false,
      role: data.role || "general",
      companies: data.companies || [],
      createdAt: data.createdAt,
    };
  });
}

/** Admins: every company. Others: the companies on their users/{uid} doc. */
export async function listCompanies(
  role: string | null,
  user: User | null,
): Promise<CompanyRecord[]> {
  if (role === "admin") {
    const snapshot = await getDocs(
      query(collection(db, "companies"), orderBy("name", "asc")),
    );
    return snapshot.docs.map((companyDoc) =>
      mapCompanyDoc(companyDoc.id, companyDoc.data()),
    );
  }
  if (!user) return [];
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const companyIds = Array.isArray(userSnap.data()?.companies)
    ? (userSnap.data()?.companies as string[])
    : [];
  if (companyIds.length === 0) return [];
  const snaps = await Promise.all(
    companyIds.map((companyId) => getDoc(doc(db, "companies", companyId))),
  );
  return snaps
    .filter((snap) => snap.exists())
    .map((snap) =>
      mapCompanyDoc(snap.id, snap.data() as Record<string, unknown>),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Active companies for the "assign companies" picker. */
export async function companyOptions(): Promise<
  { id: string; name: string }[]
> {
  const companySnapshot = await getDocs(collection(db, "companies"));
  return companySnapshot.docs
    .filter((companyDoc) => companyDoc.data().entityStatus !== false)
    .map((companyDoc) => ({
      id: companyDoc.id,
      name: (companyDoc.data().name as string) ?? companyDoc.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function auditLogs(): Promise<AuditLogEntry[]> {
  const [logsSnap, usersSnap, companiesSnap] = await Promise.all([
    getDocs(query(collection(db, "auditLogs"), orderBy("createdAt", "desc"))),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "companies")),
  ]);

  const usernames = new Map<string, string>();
  usersSnap.docs.forEach((userDoc) => {
    const data = userDoc.data();
    const name =
      typeof data.username === "string" && data.username
        ? data.username
        : typeof data.email === "string" && data.email
          ? data.email
          : typeof data.removedEmail === "string" && data.removedEmail
            ? data.removedEmail
            : userDoc.id;
    // Tell a removed account apart from a new one reusing the name/email.
    usernames.set(
      userDoc.id,
      data.entityStatus === false ? `${name} (removed)` : name,
    );
  });

  const companyNames = new Map<string, string>();
  companiesSnap.docs.forEach((companyDoc) => {
    const data = companyDoc.data();
    companyNames.set(
      companyDoc.id,
      typeof data.name === "string" && data.name ? data.name : companyDoc.id,
    );
  });

  const rows: AuditLogEntry[] = logsSnap.docs.map((logDoc) => {
    const data = logDoc.data() as Record<string, unknown>;
    const userId = typeof data.userId === "string" ? data.userId : "";
    const companyId = typeof data.companyId === "string" ? data.companyId : "";

    return {
      id: logDoc.id,
      action: typeof data.action === "string" ? data.action : "",
      description: typeof data.description === "string" ? data.description : "",
      companyId,
      companyName: companyId ? (companyNames.get(companyId) ?? companyId) : "",
      userId,
      username: userId ? (usernames.get(userId) ?? userId) : "",
      transactionId:
        typeof data.transactionId === "string" ? data.transactionId : "",
      entityStatus: data.entityStatus !== false,
      createdAt: toDate(data.createdAt) ?? null,
    };
  });

  return rows;
}

// ── Writes (moved verbatim) ─────────────────────────────────────────────

export async function createCompany({
  companyName,
  data,
  user,
}: {
  companyName: string;
  data: CompanyFields;
  user: User;
}) {
  const batch = writeBatch(db);
  const companyRef = doc(collection(db, "companies"));
  batch.set(companyRef, {
    name: companyName,
    address: data.address.trim(),
    telephoneNo: data.telephoneNo.trim(),
    tin: data.tin.trim(),
    entityStatus: true,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  });

  const userRef = doc(db, "users", user.uid);
  batch.update(userRef, {
    companies: arrayUnion(companyRef.id),
  });

  const auditLogRef = doc(collection(db, "auditLogs"));
  batch.set(auditLogRef, {
    userId: user.uid,
    action: "create",
    description: `Company created: ${companyName}`,
    companyId: companyRef.id,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function updateCompany({
  companyName,
  data,
  user,
  company,
}: {
  companyName: string;
  data: CompanyFields;
  user: User;
  company: { id: string };
}) {
  const batch = writeBatch(db);
  const companyRef = doc(db, "companies", company.id);
  batch.update(companyRef, {
    name: companyName,
    address: data.address.trim(),
    telephoneNo: data.telephoneNo.trim(),
    tin: data.tin.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  const auditLogRef = doc(collection(db, "auditLogs"));
  batch.set(auditLogRef, {
    userId: user.uid,
    action: "update",
    description: `Company updated: ${companyName}`,
    companyId: company.id,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function setCompanyActive({
  company,
  nextActive,
  user,
}: {
  company: { id: string; name: string };
  nextActive: boolean;
  user: User;
}) {
  const batch = writeBatch(db);
  const companyRef = doc(db, "companies", company.id);
  batch.update(companyRef, {
    entityStatus: nextActive,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  const auditLogRef = doc(collection(db, "auditLogs"));
  batch.set(auditLogRef, {
    userId: user.uid,
    action: "update",
    description: `Company ${nextActive ? "activated" : "deactivated"}: ${company.name}`,
    companyId: company.id,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Creates the sign-in through a second Firebase app, writes users/{uid},
 * sends the welcome email, and rolls everything back if any step fails.
 */
export async function createUser({
  data,
  currentUser,
  welcomeTemplate,
}: {
  data: { username: string; email: string; role: string; companies: string[] };
  currentUser: User | null;
  welcomeTemplate: string;
}) {
  let userCredential: UserCredential | undefined;
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
      messagingSenderId:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    };

    let secondaryApp: FirebaseApp;
    try {
      secondaryApp = getApp("SecondaryClient");
    } catch {
      secondaryApp = initializeApp(firebaseConfig, "SecondaryClient");
    }

    const secondaryAuth = getAuth(secondaryApp);

    const password = generateRandomPassword();
    userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      data.email,
      password,
    );
    const authUser = userCredential.user;

    const batch = writeBatch(db);

    // 1️⃣ Add user to Firestore
    const userRef = doc(db, "users", authUser.uid);
    batch.set(userRef, {
      username: data.username,
      email: data.email,
      role: data.role,
      companies: data.companies,
      firstSignIn: true,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });

    // 2️⃣ Add Audit Log
    const auditLogRef = doc(collection(db, "auditLogs"));
    batch.set(auditLogRef, {
      userId: currentUser?.uid,
      action: "create",
      description: `User created: ${data.username} (${data.email})`,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    // 3️⃣ Generate and send a personalized password reset link via custom email
    await axios.post("/api/users/send-reset-link", {
      email: data.email,
      subject: "Welcome to Stuttgart",
      htmlTemplate: welcomeTemplate,
    });

    // 4️⃣ Clean up secondary auth session
    await signOut(secondaryAuth);
  } catch (error) {
    // Rollback if user was created but process failed
    if (userCredential?.user) {
      try {
        await deleteDoc(doc(db, "users", userCredential.user.uid));
        await userCredential.user.delete();
        console.log("Rolled back user creation");
      } catch (rollbackError) {
        console.error("Failed to rollback user creation", rollbackError);
      }
    }
    throw error;
  }
}

export async function updateUsername({
  user,
  nextUsername,
}: {
  user: User;
  nextUsername: string;
}) {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", user.uid), {
    username: nextUsername,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "auditLogs")), {
    userId: user.uid,
    action: "update",
    description: `Username changed to ${nextUsername}`,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function logPasswordChange({
  currentUser,
}: {
  currentUser: User;
}) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "auditLogs")), {
    userId: currentUser.uid,
    action: "update",
    description: "Password changed",
    entityStatus: true,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Moved from add-user-dialog.tsx unchanged. */
function generateRandomPassword() {
  const length = 10;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}
