import { defineConfig } from "vitest/config";
import { E2E_DATABASE_URL } from "./test/e2e/env.js";

export default defineConfig({
    resolve: { tsconfigPaths: true },
    test: {
        globals: true,
        root: "./",
        include: ["test/**/*.e2e-spec.ts"],
        globalSetup: ["./test/e2e/global-setup.ts"],
        // Every file resets the same database, so files must not run at the same time.
        fileParallelism: false,
        env: { DATABASE_URL: E2E_DATABASE_URL, NODE_ENV: "test" },
        testTimeout: 20_000,
        hookTimeout: 60_000,
    },
});
