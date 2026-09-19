import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Several spec files (public-catalog.spec.ts, admin-catalog.spec.ts)
  // exercise the real seeded campaign's ACTIVE/DRAFT status against the
  // same dev database and each already serializes its own tests
  // internally for exactly that reason — but nothing serialized *between*
  // files, so two such files running in different parallel workers could
  // race on that same shared row (observed: one flipped it mid-run of
  // the other, breaking an unrelated assertion). A single worker removes
  // that category of cross-file interference entirely; this suite is
  // small enough that the speed cost is negligible.
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
