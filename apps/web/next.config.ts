import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Single source of truth: read the monorepo-root .env (no-op in Docker, where env is injected).
const root = path.resolve(__dirname, "../..");
loadEnvConfig(root);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_PUBLIC_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;
