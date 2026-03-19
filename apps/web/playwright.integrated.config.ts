import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.integration\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "cmd /c ..\\..\\services\\api\\.venv\\Scripts\\python.exe ..\\..\\services\\api\\scripts\\start_smoke_backend.py",
      url: "http://127.0.0.1:8000/health/",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: "cmd /c npm run dev -- --hostname 127.0.0.1 --port 3100",
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000",
        NEXT_DISABLE_EDGE_AUTH_GUARD: "false",
        NEXT_DIST_DIR: ".next-integration-smoke",
      },
      url: "http://127.0.0.1:3100/login",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
