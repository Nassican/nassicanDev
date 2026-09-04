import path from "node:path";
import type { NextConfig } from "next";

/**
 * See apps/web/next.config.ts: both apps pin the workspace root explicitly
 * rather than letting Turbopack and the file tracer infer it from the lockfile.
 */
const monorepoRoot = path.join(import.meta.dirname, "..", "..");

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  /** Workspace packages ship TypeScript source, not a build. */
  transpilePackages: ["@nassican/db", "@nassican/shared"],
  /** Prisma loads its query engine at runtime; bundling it breaks that. */
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
