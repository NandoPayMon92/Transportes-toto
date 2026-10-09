/**
 * Arranque en servidores sin consola (p. ej. Render):
 * migraciones, datos iniciales, demo opcional (CARGAR_DEMO=true) y primer administrador
 * (ADMIN_USUARIO / ADMIN_CLAVE) si todavía no existe. Es seguro ejecutarlo en cada inicio.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { sembrar } from "../prisma/seed";
import { hashClave, validarPoliticaClave } from "../src/server/auth/clave";

const prisma = new PrismaClient();

async function main() {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  await sembrar(prisma);

  const usuario = process.env.ADMIN_USUARIO?.trim().toLowerCase();
  const clave = process.env.ADMIN_CLAVE;
  if (usuario && clave && !(await prisma.user.findUnique({ where: { usuario } }))) {
    const err = validarPoliticaClave(clave);
    if (err) {
      console.error(`ADMIN_CLAVE no cumple la política: ${err} No se creó el administrador.`);
    } else {
      const rol = await prisma.role.findUniqueOrThrow({ where: { codigo: "ADMIN" } });
      await prisma.user.create({
        data: { usuario, nombre: "Administrador", roleId: rol.id, passwordHash: await hashClave(clave), puedeExportar: true, debeCambiarClave: true },
      });
      console.log(`Administrador "${usuario}" creado.`);
    }
  }

  if (process.env.CARGAR_DEMO === "true") execSync("npx tsx prisma/demo.ts", { stdio: "inherit" });
}

main()
  .catch((e) => {
    console.error("Error en el arranque:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
