import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
