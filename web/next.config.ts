import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Server-only packages that must not be bundled.
  serverExternalPackages: ["pg-boss", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
