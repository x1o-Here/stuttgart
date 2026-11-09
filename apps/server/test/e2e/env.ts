/** The throwaway database the e2e tests run against (same Docker Postgres, own database). */
export const E2E_DATABASE = "stuttgart_e2e";
export const E2E_DATABASE_URL =
    process.env.E2E_DATABASE_URL ?? `postgresql://stuttgart:stuttgart@localhost:5433/${E2E_DATABASE}?schema=public`;
