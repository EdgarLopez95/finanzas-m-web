import type { NextConfig } from "next";
import path from "node:path";

// ORQ-041 / DEC-081: la Web tiene un solo entorno (finanzas-m-plus real), asi
// que el artefacto solo se separa por modo de ejecucion. Se conservan nombres
// distintos de cache a proposito. En Vercel se usa la salida estandar de Next.
const isVercel = Boolean(process.env.VERCEL);
const isDevelopment = process.env.NODE_ENV === "development";
const distDir = isVercel ? undefined : (isDevelopment ? ".next-qa-dev" : ".next-qa");

// Herramientas exclusivas de desarrollo/QA (diagnostico de lecturas y reinicio
// de cuenta). Un build de produccion las incluye SOLO si se piden de forma
// explicita con esta bandera; en cualquier otro caso el modulo se sustituye por
// un stub inerte.
const qaToolsRequested = process.env.NEXT_PUBLIC_MPLUS_QA_TOOLS === "1";

const QA_TOOLS_BARREL = /[\\/]features[\\/]qa-reset[\\/]index\.tsx?$/;

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),

  // Se declara explicitamente para que Next la sustituya por un LITERAL en el
  // bundle. Sin esto, una variable `NEXT_PUBLIC_*` ausente del entorno queda
  // como lectura en runtime y ninguna condicion que dependa de ella se pliega.
  env: {
    NEXT_PUBLIC_MPLUS_QA_TOOLS: qaToolsRequested ? "1" : "0",
  },

  webpack: (config, { dev, webpack }) => {
    // NOTA para quien venga a optimizar el arranque en desarrollo: NO tiene
    // sentido tocar `config.devtool` aqui. Next lo revierte y avisa por
    // consola («Reverting webpack devtool»), porque cambiarlo rompe el overlay
    // de errores. Se probo en este repo y no movio ni un KB.

    // Gate de release: en produccion el diagnostico QA y el wipe de cuenta no
    // deben viajar en el bundle.
    //
    // Se comprobo contra el bundle real que NO basta con una condicion en el
    // codigo ni con `resolve.alias` sobre el especificador `@/...`: el primero
    // no se pliega si la bandera no existe en el entorno, y el segundo no
    // intercepta la resolucion de los `paths` de TypeScript.
    // `NormalModuleReplacementPlugin` actua sobre la ruta YA resuelta, asi que
    // el modulo real ni siquiera se analiza.
    if (!dev && !qaToolsRequested) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(QA_TOOLS_BARREL, (resource: { request: string }) => {
          resource.request = path.join(
            __dirname,
            "src/features/qa-reset/production-stub.tsx",
          );
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
