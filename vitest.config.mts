import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Database tests share one throwaway database, so test files run one at a time.
  test: { include: ["test/**/*.test.ts"], fileParallelism: false },
});
