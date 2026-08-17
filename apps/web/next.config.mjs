import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@workstream/contracts", "@workstream/domain"],
  turbopack: {
    // Monorepo root (avoid picking up ~/package-lock.json as workspace root).
    root: path.join(__dirname, "../.."),
  },
  env: {
    NEXT_PUBLIC_API_URL:
      globalThis.process?.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
