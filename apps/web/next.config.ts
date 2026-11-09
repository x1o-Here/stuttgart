import type { NextConfig } from "next";

/**
 * Production stays on Firestore until the cutover (Phase 7). A production
 * build with NEXT_PUBLIC_API_FEATURES set would silently move users onto the
 * API, so it is refused unless the cutover is declared with STUTTGART_CUTOVER=1.
 *
 * "Production" means VERCEL_ENV=production (Vercel) or APP_ENV=production
 * (anywhere else); plain local `next build` is not affected.
 */
const apiFeatures = process.env.NEXT_PUBLIC_API_FEATURES?.trim();
const isProductionDeploy =
  process.env.VERCEL_ENV === "production" ||
  process.env.APP_ENV === "production";
if (
  apiFeatures &&
  isProductionDeploy &&
  process.env.STUTTGART_CUTOVER !== "1"
) {
  throw new Error(
    `NEXT_PUBLIC_API_FEATURES="${apiFeatures}" is set for a production build. ` +
      "Production must stay on Firestore until the cutover. Remove the variable, " +
      "or set STUTTGART_CUTOVER=1 if this deploy *is* the cutover.",
  );
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["firebase-admin", "nodemailer"],
  transpilePackages: ["@stuttgart/shared"],
};

export default nextConfig;
