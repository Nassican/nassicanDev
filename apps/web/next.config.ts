import path from "node:path";
import type { NextConfig } from "next";

/**
 * This app lives in a workspace, not at the repository root. Both Turbopack
 * and the production file tracer walk upwards looking for a lockfile to infer
 * the workspace root; pointing them at it explicitly keeps that inference from
 * changing behaviour when a sibling app is added.
 */
const monorepoRoot = path.join(import.meta.dirname, "..", "..");

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  /** Workspace packages ship TypeScript source, not a build. */
  transpilePackages: ["@nassican/shared", "@nassican/db"],
  /** Prisma loads its query engine at runtime; bundling it breaks that. */
  serverExternalPackages: ["@prisma/client"],
  /**
   * The query engine is a binary loaded by path, not by import, so the tracer
   * cannot infer it. Without this the build succeeds and every database call
   * fails at runtime on Vercel.
   */
  outputFileTracingIncludes: {
    "/**": ["../../packages/db/generated/prisma/**/*"],
  },
};

export default nextConfig;
