import { defineConfig } from "prisma/config";

// DATABASE_URL is only required by commands that talk to the database (migrate deploy).
// `prisma generate` and `prisma validate` run without it (CI, Docker build stage).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] ?? "" },
});
