import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3401",
    headless: true,
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: [
    {
      command: "node ../api/test/studio-e2e-server.mjs",
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
      url: "http://127.0.0.1:4401/test-fixture",
      timeout: 30000,
      reuseExistingServer: false,
    },
    {
      command: "pnpm media:prepare && pnpm exec next dev --hostname 127.0.0.1 --port 3401",
      url: "http://127.0.0.1:3401",
      timeout: 90000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:4401",
        NEXT_PUBLIC_SUPABASE_URL: "https://studio-test.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "studio-test-key",
      },
    },
  ],
});
