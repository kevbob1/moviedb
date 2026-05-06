if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // For Docker builds, DATABASE_URL may not be set yet, so provide a placeholder
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pharmacy_simulator",
  },
});
