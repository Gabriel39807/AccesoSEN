import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const mockedApiBaseUrl = "http://127.0.0.1:8000";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: /.*\.integration\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "cmd /c npm run start -- --hostname 127.0.0.1 --port 3100",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: mockedApiBaseUrl,
      NEXT_PUBLIC_AUTH_COOKIE_MODE: "false",
      NEXT_DISABLE_EDGE_AUTH_GUARD: "true",
    },
    port: 3100,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
