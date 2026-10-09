import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

/** Aplica las migraciones sobre la base de pruebas antes de ejecutar la suite. */
export default function setup() {
  if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Defina TEST_DATABASE_URL para ejecutar las pruebas de integración.");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
}
