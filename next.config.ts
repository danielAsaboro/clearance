import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const localTailwindCssEntry = path.join(
  projectRoot,
  "node_modules",
  "tailwindcss",
  "index.css"
);

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      tailwindcss: localTailwindCssEntry,
    },
  },
  async headers() {
    return [
      {
        // CORS headers for API access
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
