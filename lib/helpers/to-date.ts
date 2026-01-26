import { Timestamp } from "firebase/firestore";

export function toDate(value: any): Date | undefined {
  if (!value) return undefined;

  // Firestore Timestamp
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  // Timestamp-like (safety)
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  // Already a Date
  if (value instanceof Date) {
    return value;
  }

  // String fallback
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}
