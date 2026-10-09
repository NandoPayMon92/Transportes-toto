import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
const DB = process.env.TEST_DATABASE_URL!;
const PUERTO = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: "es-UY",
    timezoneId: "America/Montevideo",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Requiere haber ejecutado "npm run build". Usa la base de pruebas.
    command: `npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/login`,
    env: { DATABASE_URL: DB, NEXT_TELEMETRY_DISABLED: "1" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
