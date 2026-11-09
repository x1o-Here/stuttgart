/**
 * Identity slice for the screens: profile, users, companies, audit log.
 * Each function uses the API or Firestore depending on the "identity" flag,
 * so components never touch either directly.
 */

import axios from "axios";
import type { User } from "firebase/auth";
import { ApiError } from "@/lib/api-client";
import { usesApi } from "../flags";
import { identityApi } from "./api";
import * as firestore from "./firestore";
import type { CompanyFields, ProfileData } from "./types";

export type {
  AuditLogEntry,
  CompanyFields,
  ProfileData,
  UserRow,
} from "./types";

const api = () => usesApi("identity");

/** The signed-in user's profile; null when there is none yet. Throws for removed accounts. */
export async function loadProfile(user: User): Promise<ProfileData | null> {
  if (!api()) return firestore.loadProfile(user);
  try {
    const me = await identityApi.me();
    return { username: me.username, role: me.role, companies: me.companies };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      if (/removed/i.test(error.message)) {
        const { signOut } = await import("firebase/auth");
        const { auth } = await import("@/lib/firebase/firebase-client");
        await signOut(auth);
        throw new Error("This account has been removed.");
      }
      return null; // signed in, but no profile row yet
    }
    throw error;
  }
}

/** Used right after Google sign-in: is this account provisioned? */
export async function hasProfile(uid: string): Promise<boolean> {
  if (!api()) return firestore.hasProfile(uid);
  return identityApi.me().then(
    () => true,
    (error) => !(error instanceof ApiError && error.status === 403),
  );
}

export const listUsers = () =>
  api() ? identityApi.listUsers() : firestore.listUsers();

export const listCompanies = (role: string | null, user: User | null) =>
  api() ? identityApi.listCompanies() : firestore.listCompanies(role, user);

export const companyOptions = () =>
  api() ? identityApi.companyOptions() : firestore.companyOptions();

export const auditLogs = () =>
  api() ? identityApi.auditLogs() : firestore.auditLogs();

export function createCompany(user: User, input: CompanyFields) {
  return api()
    ? identityApi.createCompany(input)
    : firestore.createCompany({ companyName: input.name, data: input, user });
}

export function updateCompany(
  user: User,
  company: { id: string },
  input: CompanyFields,
) {
  return api()
    ? identityApi.updateCompany(company.id, input)
    : firestore.updateCompany({
        companyName: input.name,
        data: input,
        user,
        company,
      });
}

export function setCompanyActive(
  user: User,
  company: { id: string; name: string },
  nextActive: boolean,
) {
  return api()
    ? identityApi.setCompanyActive(company.id, nextActive)
    : firestore.setCompanyActive({ company, nextActive, user });
}

/**
 * Creates the user and emails them a "set your password" link.
 * Firestore mode: any failure rolls the new account back and throws.
 * API mode: the account stays if only the email fails (emailFailed: true).
 */
export async function createUser({
  data,
  currentUser,
  welcomeTemplate,
}: {
  data: { username: string; email: string; role: string; companies: string[] };
  currentUser: User | null;
  welcomeTemplate: string;
}): Promise<{ emailFailed: boolean }> {
  if (!api()) {
    await firestore.createUser({ data, currentUser, welcomeTemplate });
    return { emailFailed: false };
  }
  await identityApi.createUser({
    username: data.username,
    email: data.email,
    role: data.role as "admin" | "manager" | "general" | "technician",
    companies: data.companies,
  });
  try {
    await axios.post("/api/users/send-reset-link", {
      email: data.email,
      subject: "Welcome to Stuttgart",
      htmlTemplate: welcomeTemplate,
    });
    return { emailFailed: false };
  } catch (emailError) {
    console.error("User created but the welcome email failed", emailError);
    return { emailFailed: true };
  }
}

export const updateUsername = (user: User, nextUsername: string) =>
  api()
    ? identityApi.updateUsername(nextUsername)
    : firestore.updateUsername({ user, nextUsername });

export const logPasswordChange = (currentUser: User) =>
  api()
    ? identityApi.logPasswordChange()
    : firestore.logPasswordChange({ currentUser });
