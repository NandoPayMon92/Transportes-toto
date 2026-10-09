/**
 * Datos iniciales obligatorios (idempotente): roles, clientes iniciales y configuración de cálculo.
 * No crea tarifas: los importes reales deben cargarse desde la pantalla de Tarifario o la plantilla Excel.
 */
import { PrismaClient } from "@prisma/client";
import { CONFIGURACION_PREDETERMINADA } from "../src/lib/domain/tipos";

const prisma = new PrismaClient();

export const ROLES_INICIALES = [
  { codigo: "ADMIN", nombre: "Administrador" },
  { codigo: "LOGISTICA", nombre: "Logística" },
  { codigo: "CONSULTA", nombre: "Consulta / administración" },
];

export const CLIENTES_INICIALES = ["Paycueros SA", "SAMIFRUIT", "CARGILL SA", "GRANICOR"];

export async function sembrar(db: PrismaClient = prisma) {
  for (const r of ROLES_INICIALES) {
    await db.role.upsert({ where: { codigo: r.codigo }, create: r, update: { nombre: r.nombre } });
  }
  for (const nombre of CLIENTES_INICIALES) {
    await db.client.upsert({
      where: { nombre },
      create: { nombre, observaciones: "Cliente inicial. Tarifas pendientes de configuración." },
      update: {},
    });
  }
  await db.setting.upsert({
    where: { clave: "calculo" },
    create: { clave: "calculo", valor: { ...CONFIGURACION_PREDETERMINADA } },
    update: {},
  });
}

if (require.main === module) {
  sembrar()
    .then(() => console.log("Datos iniciales cargados: roles, clientes y configuración."))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
