import { randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { MeDto, MeUpdate, UserCreate, UserDto } from "@stuttgart/shared/schemas/identity";
import { FirebaseService } from "../../infra/firebase/firebase.service.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";

/** Sign-in address given to a removed account so its real email can be reused. */
const removedEmailFor = (uid: string) => `removed+${uid}@removed.invalid`;

const firebaseCode = (error: unknown) => (error as { code?: string } | null)?.code;

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly firebase: FirebaseService,
    ) {}

    // ── Me ──────────────────────────────────────────────────────────────

    async me(user: AuthUser): Promise<MeDto> {
        const companies = await this.prisma.company.findMany({
            where: { id: { in: user.companyIds } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
        return { uid: user.uid, username: user.username, role: user.role, companies };
    }

    /** Was the username form on the profile page. */
    async updateMe(user: AuthUser, input: MeUpdate): Promise<MeDto> {
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: user.uid }, data: { username: input.username } });
            await audit(tx, { userId: user.uid, action: "update", description: `Username changed to ${input.username}` });
        });
        return this.me({ ...user, username: input.username });
    }

    /** The password itself is changed in Firebase Auth by the browser; this records it. */
    async logPasswordChange(user: AuthUser): Promise<void> {
        await audit(this.prisma, { userId: user.uid, action: "update", description: "Password changed" });
    }

    // ── Users (admin) ───────────────────────────────────────────────────

    async list(): Promise<UserDto[]> {
        const users = await this.prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            include: { companies: { include: { company: { select: { name: true } } } } },
        });
        return users.map((u) => ({
            id: u.id,
            username: u.username || "N/A",
            email: u.email || "N/A",
            role: u.role,
            companies: u.companies.map((c) => c.companyId),
            companyNames: u.companies.map((c) => c.company.name),
            removed: !u.entityStatus,
            createdAt: u.createdAt.toISOString(),
        }));
    }

    /**
     * Was add-user-dialog.tsx, which created the Firebase account from the
     * browser through a second Firebase app. Now the server creates the
     * sign-in and the profile together, and undoes the sign-in if saving the
     * profile fails. The welcome email is still sent by the web app.
     */
    async create(caller: AuthUser, input: UserCreate): Promise<UserDto> {
        const email = input.email.trim().toLowerCase();
        if (input.role === "admin" && caller.role !== "admin") {
            throw new ForbiddenException("Only admins can create admins");
        }
        const companies = await this.prisma.company.findMany({
            where: { id: { in: input.companies ?? [] } },
            select: { id: true, name: true },
        });

        let uid: string;
        try {
            const created = await this.firebase.auth.createUser({
                email,
                password: randomBytes(24).toString("base64url"),
                displayName: input.username,
            });
            uid = created.uid;
        } catch (error) {
            if (firebaseCode(error) === "auth/email-already-exists") {
                throw new ConflictException("A user with this email already exists.");
            }
            if (firebaseCode(error) === "auth/invalid-email") throw new BadRequestException("Enter a valid email.");
            throw error;
        }

        try {
            const user = await this.prisma.$transaction(async (tx) => {
                const row = await tx.user.create({
                    data: { id: uid, username: input.username, email, role: input.role, firstSignIn: true },
                });
                await tx.userCompany.createMany({ data: companies.map((c) => ({ userId: uid, companyId: c.id })) });
                await audit(tx, {
                    userId: caller.uid,
                    action: "create",
                    description: `User created: ${input.username} (${email})`,
                    entityId: uid,
                });
                return row;
            });
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                companies: companies.map((c) => c.id),
                companyNames: companies.map((c) => c.name),
                removed: false,
                createdAt: user.createdAt.toISOString(),
            };
        } catch (error) {
            await this.firebase.auth.deleteUser(uid).catch(() => undefined);
            throw error;
        }
    }

    /**
     * Was app/api/users/remove. The account is not deleted: its sign-in is
     * disabled and its email released, while the profile row stays so audit
     * history keeps the name.
     */
    async remove(caller: AuthUser, uid: string): Promise<void> {
        if (uid === caller.uid) throw new BadRequestException("You can't remove your own account");
        const target = await this.prisma.user.findUnique({ where: { id: uid } });
        if (!target) throw new NotFoundException("User not found");
        if (!target.entityStatus) throw new ConflictException("User is already removed");
        if (target.role === "admin" && caller.role !== "admin") {
            throw new ForbiddenException("Only admins can remove admins");
        }

        // Free the email in Auth first; if this fails nothing has changed yet.
        try {
            const authUser = await this.firebase.auth.getUser(uid);
            // Linked sign-ins (e.g. Google) are keyed by provider, not email: unlink them too.
            const providersToUnlink = authUser.providerData
                .map((p) => p.providerId)
                .filter((id) => id !== "password");
            await this.firebase.auth.updateUser(uid, {
                email: removedEmailFor(uid),
                disabled: true,
                ...(providersToUnlink.length ? { providersToUnlink } : {}),
            });
            await this.firebase.auth.revokeRefreshTokens(uid);
        } catch (error) {
            // Auth account already deleted by hand: the email is free anyway.
            if (firebaseCode(error) !== "auth/user-not-found") throw error;
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id: uid }, data: { entityStatus: false, email: "" } });
            await audit(tx, {
                userId: caller.uid,
                action: "delete",
                description: `User removed: ${target.username}${target.email ? ` (${target.email})` : ""}`,
                entityId: uid,
            });
        });
    }
}
