import type { NextConfig } from "next";
import path from "node:path";

// ORQ-041 / DEC-081: la Web tiene un solo entorno (finanzas-m-plus real), asi
// que el artefacto solo se separa por modo de ejecucion. Se conservan nombres
// distintos de `.next` a proposito: un servidor de desarrollo y un build de
// produccion nunca deben compartir cache.
const isDevelopment = process.env.NODE_ENV === "development";
const distDir = isDevelopment ? ".next-qa-dev" : ".next-qa";

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
