import { Module } from "@nestjs/common";
import { ReadModelController } from "./read-model.controller.js";
import { ReadModelService } from "./read-model.service.js";

@Module({ controllers: [ReadModelController], providers: [ReadModelService] })
export class ReadModelModule {}
