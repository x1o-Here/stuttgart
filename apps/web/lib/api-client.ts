import axios from "axios";
import { auth } from "@/lib/firebase/firebase-client";

/** HTTP client for apps/server. Every request carries the signed-in user's Firebase ID token. */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
});

// getIdToken() returns a cached token and refreshes it shortly before it expires.
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
