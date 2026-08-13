import type { NextConfig } from "next";
import path from "node:path";

const distDir =
  process.env.NEXT_PUBLIC_FIREBASE_RUNTIME === "QA_REAL"
    ? ".next-qa"
    : process.env.NODE_ENV === "development"
      ? ".next-dev"
      : ".next";

const nextConfig: NextConfig = {
  distDir,
  webpack: (config, { dev }) => {
    // Gate de release: en producción el wipe QA no debe viajar en el bundle.
    if (!dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/features/qa-reset": path.join(__dirname, "src/features/qa-reset/production-stub.tsx"),
        "@/features/qa-reset/lib/qa-reset-availability": path.join(
          __dirname,
          "src/features/qa-reset/production-stub.tsx",
        ),
        "@/features/qa-reset/components/qa-reset-confirm-dialog": path.join(
          __dirname,
          "src/features/qa-reset/production-stub.tsx",
        ),
      };
    }
    return config;
  },
};

export default nextConfig;
