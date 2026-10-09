import { prisma } from "@/server/db";
import type { FiltrosViaje } from "./viajes";

/** Nombres legibles de los filtros aplicados (para la hoja "Filtros" del Excel). */
export async function nombresFiltros(f: FiltrosViaje): Promise<Record<string, string>> {
  const out: Record<string, string> = {
    "clientId:label": "Cliente",
    "vehicleId:label": "Matrícula",
    "driverId:label": "Chofer",
    "cargoTypeId:label": "Tipo de carga",
    "origenId:label": "Lugar de carga",
    "destinoId:label": "Lugar de descarga",
  };
  if (f.clientId) out.clientId = (await prisma.client.findUnique({ where: { id: f.clientId } }))?.nombre ?? f.clientId;
  if (f.vehicleId) out.vehicleId = (await prisma.vehicle.findUnique({ where: { id: f.vehicleId } }))?.matricula ?? f.vehicleId;
  if (f.driverId) out.driverId = (await prisma.driver.findUnique({ where: { id: f.driverId } }))?.nombre ?? f.driverId;
  if (f.cargoTypeId) out.cargoTypeId = (await prisma.cargoType.findUnique({ where: { id: f.cargoTypeId } }))?.nombre ?? f.cargoTypeId;
  if (f.origenId) out.origenId = (await prisma.location.findUnique({ where: { id: f.origenId } }))?.nombre ?? f.origenId;
  if (f.destinoId) out.destinoId = (await prisma.location.findUnique({ where: { id: f.destinoId } }))?.nombre ?? f.destinoId;
  return out;
}
