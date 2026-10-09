import { ZodError } from "zod";
import { prisma, type Tx } from "@/server/db";
import { AppError, ErrorValidacion } from "@/server/errores";
import { exigir } from "./autorizacion";
import { crearTarifa } from "./tarifas";
import type { Actor } from "@/lib/permisos";
import type { FilaImportacion } from "@/server/excel";

async function buscarOCrearLugar(tx: Tx, nombre: string, uso: "carga" | "descarga", creados: string[]) {
  const existente = await tx.location.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  if (existente) {
    const campo = uso === "carga" ? "esCarga" : "esDescarga";
    if (!existente[campo]) await tx.location.update({ where: { id: existente.id }, data: { [campo]: true } });
    return existente.id;
  }
  const nuevo = await tx.location.create({ data: { nombre, esCarga: uso === "carga", esDescarga: uso === "descarga" } });
  creados.push(`Lugar: ${nombre}`);
  return nuevo.id;
}

async function buscarOCrearCarga(tx: Tx, nombre: string, creados: string[]) {
  const existente = await tx.cargoType.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  if (existente) return existente.id;
  creados.push(`Tipo de carga: ${nombre}`);
  return (await tx.cargoType.create({ data: { nombre } })).id;
}

/** Importa tarifas desde la plantilla. Todo o nada: si una fila falla, no se guarda ninguna. */
export async function importarTarifas(actor: Actor, filas: FilaImportacion[]) {
  exigir(actor, "tarifas.gestionar");
  if (filas.length === 0) throw new ErrorValidacion("El archivo no contiene filas para importar.");
  if (filas.length > 2000) throw new ErrorValidacion("El archivo tiene demasiadas filas (máximo 2000).");
  const pendientes = filas.filter((f) => !f.importe).map((f) => f.fila);
  const aImportar = filas.filter((f) => f.importe);
  const errores: Array<{ fila: number; mensaje: string }> = [];
  const creados: string[] = [];
  let importadas = 0;

  class Abortar extends Error {}
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const f of aImportar) {
          try {
            const cliente = await tx.client.findFirst({ where: { nombre: { equals: f.cliente, mode: "insensitive" } } });
            if (!cliente) throw new ErrorValidacion(`El cliente "${f.cliente}" no existe.`);
            await crearTarifa(
              actor,
              {
                clientId: cliente.id,
                modalidad: f.modalidad,
                importe: f.importe,
                moneda: f.moneda,
                unidad: f.modalidad === "POR_PESO" ? f.unidad || null : null,
                baseCalculo: f.modalidad === "POR_PESO" ? f.baseCalculo || null : null,
                origenId: f.origen ? await buscarOCrearLugar(tx, f.origen, "carga", creados) : null,
                destinoId: f.destino ? await buscarOCrearLugar(tx, f.destino, "descarga", creados) : null,
                cargoTypeId: f.carga ? await buscarOCrearCarga(tx, f.carga, creados) : null,
                vigenciaDesde: f.vigenciaDesde,
                vigenciaHasta: f.vigenciaHasta || null,
                activo: true,
                observaciones: f.observaciones || null,
              },
              { tx, motivo: "Importación desde planilla" },
            );
            importadas++;
          } catch (e) {
            if (e instanceof ZodError) errores.push({ fila: f.fila, mensaje: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
            else if (e instanceof AppError) errores.push({ fila: f.fila, mensaje: e.message });
            else throw e;
          }
        }
        if (errores.length) throw new Abortar();
      },
      { timeout: 120_000 },
    );
  } catch (e) {
    if (e instanceof Abortar) {
      throw new ErrorValidacion(`Se encontraron ${errores.length} filas con errores. No se importó ninguna tarifa.`, { errores });
    }
    throw e;
  }
  return { importadas, pendientesOmitidas: pendientes, catalogosCreados: creados };
}
