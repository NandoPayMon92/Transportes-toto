import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { sembrar } from "../../prisma/seed";
import { hashClave } from "@/server/auth/clave";
import { crearSesion, COOKIE_SESION } from "@/server/auth/sesion";
import type { Actor } from "@/lib/permisos";
import type { Rol } from "@/lib/domain/tipos";

export async function limpiarBase() {
  const tablas = ["TripAuditLog", "Trip", "TariffAuditLog", "Tariff", "Session", "PasswordResetToken", "User", "Client", "Driver", "Vehicle", "CargoType", "Location", "Setting", "Role"];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tablas.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await sembrar(prisma);
}

let hashCache: string | null = null;
export async function crearActor(rol: Rol, puedeExportar = false, usuario = `${rol.toLowerCase()}-${randomUUID().slice(0, 6)}`): Promise<Actor> {
  hashCache ??= await hashClave("ClavePrueba123");
  const r = await prisma.role.findUniqueOrThrow({ where: { codigo: rol } });
  const u = await prisma.user.create({ data: { usuario, nombre: `Usuario ${rol}`, roleId: r.id, passwordHash: hashCache, puedeExportar } });
  return { id: u.id, nombre: u.nombre, usuario: u.usuario, rol, puedeExportar };
}

export async function catalogoBase() {
  const [cliente, otroCliente] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { nombre: "Paycueros SA" } }),
    prisma.client.findUniqueOrThrow({ where: { nombre: "CARGILL SA" } }),
  ]);
  const [vehiculo, vehiculo2] = await Promise.all([prisma.vehicle.create({ data: { matricula: "TST1001" } }), prisma.vehicle.create({ data: { matricula: "TST1002" } })]);
  const chofer = await prisma.driver.create({ data: { nombre: "Chofer Prueba" } });
  const carga = await prisma.cargoType.create({ data: { nombre: "Carga Prueba" } });
  const origen = await prisma.location.create({ data: { nombre: "Origen Prueba" } });
  const destino = await prisma.location.create({ data: { nombre: "Destino Prueba" } });
  return { cliente, otroCliente, vehiculo, vehiculo2, chofer, carga, origen, destino };
}

export type Catalogo = Awaited<ReturnType<typeof catalogoBase>>;

export function datosViaje(c: Catalogo, extra: Record<string, unknown> = {}) {
  return {
    fecha: "2026-06-15",
    vehicleId: c.vehiculo.id,
    clientId: c.cliente.id,
    driverId: c.chofer.id,
    cargoTypeId: c.carga.id,
    origenId: c.origen.id,
    destinoId: c.destino.id,
    kgSalida: "1000",
    kgLlegada: "990",
    ...extra,
  };
}

/** Petición HTTP autenticada para probar las rutas reales (incluida la autorización del backend). */
export async function peticion(url: string, opciones: { actor?: Actor; method?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (opciones.actor) {
    const { token } = await crearSesion(opciones.actor.id);
    headers.set("cookie", `${COOKIE_SESION}=${token}`);
  }
  if (opciones.body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: opciones.method ?? (opciones.body !== undefined ? "POST" : "GET"),
    headers,
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
}

export const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
