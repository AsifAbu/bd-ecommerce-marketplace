import "dotenv/config";
import { defineConfig } from "prisma/config";

// One schema file per feature lives in prisma/schema/<feature>.prisma.
export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read directly (not env()) so `prisma generate` works without a database URL.
    url: process.env.DATABASE_URL,
  },
});
