import axios, { isAxiosError } from "axios";
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

/** An error from apps/server, carrying the server's message and HTTP status. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Turn server errors into readable messages, so screens can show error.message
// exactly as they did with the Firestore code (e.g. "Tax invoice no … already exists").
api.interceptors.response.use(undefined, (error) => {
  if (!isAxiosError(error)) return Promise.reject(error);
  const data = error.response?.data as { message?: unknown } | undefined;
  const raw = data?.message;
  const message = Array.isArray(raw)
    ? raw.map((m) => String(m).replace(/^[\w.[\]]+: /, "")).join(" ")
    : typeof raw === "string"
      ? raw
      : error.response
        ? `Request failed (${error.response.status})`
        : "Can't reach the server. Check your connection.";
  return Promise.reject(new ApiError(message, error.response?.status));
});
