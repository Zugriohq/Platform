import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // PostgreSQL integration tests create and drop their own databases.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
