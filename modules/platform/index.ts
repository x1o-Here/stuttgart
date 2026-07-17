// Domain (client-safe). Server-only Firebase Admin lives at
// `@/modules/platform/domain/services/firebase-admin` — do not re-export here.
export { auth, db } from "./domain/services/firebase-client";
export { appendAuditLog, type AuditLogPayload } from "./domain/services/audit-log";
export { toDate } from "./domain/helpers/to-date";
export {
  getActiveSidebarRoute,
  type SidebarRouteKey,
} from "./domain/active-route";
export {
  MainSidebarContent,
  MainSidebarFooter,
} from "./domain/sidebar-items";

// State
export {
  AuthProvider,
  RequireAuth,
  useAuth,
  type Company,
} from "./state/auth-context";

// UI
export { default as AppSidebar } from "./ui/sidebar";
export { default as SignInPage } from "./ui/sign-in-page";
export { LoadingState, submitLabel } from "./ui/loading-state";
export { default as CalendarPopover } from "./ui/calendar-popover";
