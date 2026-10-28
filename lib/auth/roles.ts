export type Role = "admin" | "manager" | "user" | "mechanic";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "User",
  mechanic: "Mechanic",
};

export function roleLabel(role: string | null | undefined) {
  return ROLE_LABELS[role as Role] ?? "User";
}

export function isMechanic(role: string | null | undefined) {
  return role === "mechanic";
}

export function isUserAdmin(role: string | null | undefined) {
  return role === "admin" || role === "manager";
}

/** Edit or delete spare parts (mechanics may only add and assign). */
export function canEditInventory(role: string | null | undefined) {
  return !!role && !isMechanic(role);
}

/** The only routes a mechanic may open. */
export const MECHANIC_ROUTES = ["/inventory", "/profile"];

export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
) {
  if (!isMechanic(role)) return true;
  return MECHANIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
