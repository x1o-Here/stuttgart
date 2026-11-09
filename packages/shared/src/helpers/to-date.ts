/** Converts a Firestore Timestamp, Date, ISO string or epoch number to a Date. */
export function toDate(value: any): Date | undefined {
  if (!value) return undefined;

  // Firestore Timestamp (or anything with a toDate method)
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}