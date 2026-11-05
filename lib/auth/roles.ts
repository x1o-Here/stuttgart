export type Role = "admin" | "manager" | "general" | "technician";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  general: "General User",
  technician: "Technician",
};

export function roleLabel(role: string | null | undefined) {
  return ROLE_LABELS[role as Role] ?? ROLE_LABELS.general;
}

export function isTechnician(role: string | null | undefined) {
  return role === "technician";
}

export function isUserAdmin(role: string | null | undefined) {
  return role === "admin" || role === "manager";
}

/** Edit or delete spare parts (technicians may only add and assign). */
export function canEditInventory(role: string | null | undefined) {
  return !!role && !isTechnician(role);
}

/** The only routes a technician may open. */
export const TECHNICIAN_ROUTES = ["/inventory", "/profile"];

export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
) {
  if (!isTechnician(role)) return true;
  return TECHNICIAN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
