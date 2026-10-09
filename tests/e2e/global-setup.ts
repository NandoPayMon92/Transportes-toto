import { execSync } from "node:child_process";

/** Deja la base de pruebas (nunca la de desarrollo) con los datos de demostración. */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL! };
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
  execSync("npx tsx tests/e2e/vaciar-base.ts", { env, stdio: "inherit" });
  execSync("npx tsx prisma/demo.ts", { env, stdio: "ignore" });
}
