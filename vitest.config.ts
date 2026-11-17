import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" guards modules from client bundles; it is a no-op under test.
      "server-only": path.resolve(__dirname, "tests/integration/empty.ts"),
    },
  },
  test: { include: ["tests/integration/**/*.test.ts"], testTimeout: 60_000 },
});
