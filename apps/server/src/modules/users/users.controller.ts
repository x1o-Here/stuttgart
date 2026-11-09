import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { type UserCreate, userCreateSchema } from "@stuttgart/shared/schemas/identity";
import { type AuthUser, CurrentUser, Roles } from "../auth/index.js";
import { UsersService } from "./users.service.js";

/** User administration (Users page). */
@Controller("users")
@Roles("admin", "manager")
export class UsersController {
    constructor(private readonly users: UsersService) {}

    @Get()
    list() {
        return this.users.list();
    }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body({ schema: userCreateSchema }) body: UserCreate) {
        return this.users.create(user, body);
    }

    @Post(":uid/remove")
    remove(@CurrentUser() user: AuthUser, @Param("uid") uid: string) {
        return this.users.remove(user, uid);
    }
}
