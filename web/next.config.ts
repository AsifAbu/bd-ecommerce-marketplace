import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Shop documents (owner photo + licence certificate, 4 MB each) are uploaded through server actions.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
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
