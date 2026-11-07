import { StandardSchemaValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);

    app.enableCors({
        origin: config.getOrThrow<string>("WEB_ORIGIN").split(",").map((o) => o.trim()),
        allowedHeaders: ["Authorization", "Content-Type"],
    });
    // Validates any @Body({ schema }) / @Param(name, { schema }) with Zod.
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    app.enableShutdownHooks();

    await app.listen(Number(config.get("PORT") ?? 4000));
}
await bootstrap();