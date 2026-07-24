import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Prisma to work in Next.js serverless environment
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    // Server Actions are stable in Next.js 16 — no flag needed
  },
};

export default nextConfig;
