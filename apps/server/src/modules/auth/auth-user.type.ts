import type { Role } from "../../generated/prisma/client.js";

export type AuthUser = {
    uid: string;
    email: string;
    username: string;
    role: Role;
    companyIds: string[];
};