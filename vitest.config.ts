import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@netscopex/contracts": path.resolve(__dirname, "./packages/contracts/src/index.ts"),
      "@netscopex/config": path.resolve(__dirname, "./packages/config/src/index.ts"),
      "@netscopex/observability": path.resolve(__dirname, "./packages/observability/src/index.ts"),
      "@netscopex/database": path.resolve(__dirname, "./packages/database/src/index.ts"),
      "@netscopex/worker": path.resolve(__dirname, "./apps/worker/src/index.ts"),
      "@netscopex/api": path.resolve(__dirname, "./apps/api/src/server.ts"),
    },
  },
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    cache: false,
  },
});
