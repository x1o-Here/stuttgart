import { Module } from "@nestjs/common";
import { LookupsController } from "./lookups.controller.js";
import { LookupsService } from "./lookups.service.js";

@Module({ controllers: [LookupsController], providers: [LookupsService] })
export class LookupsModule {}
