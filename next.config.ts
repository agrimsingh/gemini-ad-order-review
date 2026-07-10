import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/vrdu-mini/**/*"],
  },
};

export default nextConfig;
