/**
 * @fileoverview Defines the vitest.config repository configuration module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
