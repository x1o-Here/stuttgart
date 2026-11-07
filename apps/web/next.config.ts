import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["firebase-admin", "nodemailer"],
  transpilePackages: ["@stuttgart/shared"],
};

export default nextConfig;
