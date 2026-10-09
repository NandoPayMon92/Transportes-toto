/**
 * Crea (o restablece) un usuario administrador.
 * Uso:
 *   npm run crear-admin -- --usuario admin --nombre "Nombre Apellido" [--email correo@dominio]
 * La contraseña se solicita por consola (no queda en el historial) o se toma de ADMIN_CLAVE.
 * El usuario deberá cambiarla en el primer ingreso.
 */
import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline";
import { hashClave, validarPoliticaClave } from "../src/server/auth/clave";
import { sembrar } from "../prisma/seed";

const prisma = new PrismaClient();

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function preguntarOculto(pregunta: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const rlx = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    rlx._writeToOutput = (s: string) => {
      if (s.includes(pregunta)) rlx.output.write(s);
    };
    rl.question(pregunta, (r) => {
      rl.close();
      process.stdout.write("\n");
      resolve(r);
    });
  });
}

async function main() {
  const usuario = (arg("usuario") ?? "admin").toLowerCase();
  const nombre = arg("nombre") ?? "Administrador";
  const email = arg("email")?.toLowerCase() ?? null;
  const clave = process.env.ADMIN_CLAVE ?? (await preguntarOculto("Contraseña inicial del administrador: "));
  const err = validarPoliticaClave(clave);
  if (err) throw new Error(err);

  await sembrar(prisma);
  const rol = await prisma.role.findUniqueOrThrow({ where: { codigo: "ADMIN" } });
  const passwordHash = await hashClave(clave);
  await prisma.user.upsert({
    where: { usuario },
    create: { usuario, nombre, email, roleId: rol.id, passwordHash, puedeExportar: true, debeCambiarClave: true },
    update: { roleId: rol.id, passwordHash, activo: true, debeCambiarClave: true, intentosFallidos: 0, bloqueadoHasta: null },
  });
  console.log(`Administrador "${usuario}" listo. Deberá cambiar la contraseña al ingresar.`);
}

main()
  .catch((e) => {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
