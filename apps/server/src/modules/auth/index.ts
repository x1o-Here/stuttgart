// Public surface of the auth module: feature modules import from here only.
export type { AuthUser } from "./auth-user.type.js";
export { CurrentUser } from "./decorators/current-user.decorator.js";
export { Public } from "./decorators/public.decorator.js";
export { Roles } from "./decorators/roles.decorator.js";
export { CompanyAccessGuard } from "./guards/company-access.guard.js";
