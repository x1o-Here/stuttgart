import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { type MeUpdate, meUpdateSchema } from "@stuttgart/shared/schemas/identity";
import { type AuthUser, CurrentUser } from "../auth/index.js";
import { UsersService } from "./users.service.js";

/** The signed-in user's own profile. */
@Controller("me")
export class MeController {
    constructor(private readonly users: UsersService) {}

    @Get()
    me(@CurrentUser() user: AuthUser) {
        return this.users.me(user);
    }

    @Patch()
    update(@CurrentUser() user: AuthUser, @Body({ schema: meUpdateSchema }) body: MeUpdate) {
        return this.users.updateMe(user, body);
    }

    /** Called by the web app after it changed the password in Firebase Auth. */
    @Post("password-changed")
    passwordChanged(@CurrentUser() user: AuthUser) {
        return this.users.logPasswordChange(user);
    }
}
