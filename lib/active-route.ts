export type SidebarRouteKey =
  | "dashboard"
  | "reports"
  | "accounts"
  | "settings"
  | "profile";

const ROUTE_PREFIX_MAP: Record<SidebarRouteKey, string[]> = {
  dashboard: ["/"],
  reports: ["/report", "/reports"],
  accounts: ["/account", "/accounts"],
  settings: ["/settings"],
  profile: ["/profile"],
};

/**
 * Returns the active sidebar route key based on pathname
 */
export function getActiveSidebarRoute(
  pathname: string
): SidebarRouteKey {
  // Normalize: remove trailing slash (except root)
  const normalized =
    pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;

  for (const [key, prefixes] of Object.entries(ROUTE_PREFIX_MAP)) {
    for (const prefix of prefixes) {
      if (
        normalized === prefix ||
        (prefix !== "/" && normalized.startsWith(`${prefix}/`))
      ) {
        return key as SidebarRouteKey;
      }
    }
  }

  return "dashboard";
}
