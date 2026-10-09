import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { importarTarifas } from "@/server/servicios/importacion";
import { aumentoMasivo, crearTarifa, diagnosticoTarifario, listarTarifas } from "@/server/servicios/tarifas";
import { crearEnCatalogo, eliminarDeCatalogo, listarCatalogo } from "@/server/servicios/catalogos";
import { crearViaje } from "@/server/servicios/viajes";
import { leerPlantillaTarifas, plantillaTarifas } from "@/server/excel";
import type { FilaImportacion } from "@/server/excel";
import type { Actor } from "@/lib/permisos";
import { catalogoBase, crearActor, datosViaje, limpiarBase } from "./helpers";

let admin: Actor;
let logistica: Actor;

beforeEach(async () => {
  await limpiarBase();
  admin = await crearActor("ADMIN", true);
  logistica = await crearActor("LOGISTICA");
});

const fila = (p: Partial<FilaImportacion>): FilaImportacion => ({
  fila: 2, cliente: "GRANICOR", modalidad: "POR_PESO", importe: "12.5", moneda: "USD", unidad: "TONELADA", baseCalculo: "LLEGADA",
  origen: "", destino: "", carga: "", vigenciaDesde: "2026-01-01", vigenciaHasta: "", observaciones: "", ...p,
});

describe("datos iniciales", () => {
  it("carga los cuatro clientes iniciales sin tarifas inventadas", async () => {
    const nombres = (await prisma.client.findMany()).map((c) => c.nombre).sort();
    expect(nombres).toEqual(["CARGILL SA", "GRANICOR", "Paycueros SA", "SAMIFRUIT"]);
    expect(await prisma.tariff.count()).toBe(0);
    const diag = await diagnosticoTarifario(admin);
    expect(diag.clientesSinTarifa).toHaveLength(4);
  });
});

describe("importación de tarifas desde la plantilla", () => {
  it("la plantilla trae las filas pendientes sin importe y se omiten al importar", async () => {
    const buf = await plantillaTarifas(["Paycueros SA", "SAMIFRUIT"], "PROMEDIO");
    const filas = await leerPlantillaTarifas(new Uint8Array(buf).buffer);
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.importe === "")).toBe(true);
    const r = await importarTarifas(admin, [...filas, fila({ fila: 4, origen: "Puerto Nuevo", destino: "Planta X", carga: "Soja", vigenciaDesde: "01/03/2026" })]);
    expect(r.importadas).toBe(1);
    expect(r.pendientesOmitidas).toEqual([2, 3]);
    expect(r.catalogosCreados).toEqual(expect.arrayContaining(["Lugar: Puerto Nuevo", "Tipo de carga: Soja"]));
    const [t] = await listarTarifas(admin, {});
    expect(t).toMatchObject({ cliente: "GRANICOR", moneda: "USD", vigenciaDesde: "2026-03-01", nivel: 1 });
  });

  it("es todo o nada: una fila inválida impide importar las demás", async () => {
    await expect(importarTarifas(admin, [fila({}), fila({ fila: 3, cliente: "No existe" }), fila({ fila: 4, unidad: "", vigenciaDesde: "2027-01-01" })])).rejects.toMatchObject({
      detalles: { errores: [{ fila: 3, mensaje: 'El cliente "No existe" no existe.' }, { fila: 4, mensaje: expect.stringContaining("kg o por tonelada") }] },
    });
    expect(await prisma.tariff.count()).toBe(0);
  });

  it("detecta superposiciones dentro del mismo archivo", async () => {
    await expect(importarTarifas(admin, [fila({}), fila({ fila: 3, vigenciaDesde: "2026-06-01" })])).rejects.toMatchObject({ detalles: { errores: [{ fila: 3 }] } });
  });
});

describe("aumento porcentual", () => {
  it("crea nuevas vigencias y conserva el historial", async () => {
    const c = await catalogoBase();
    await crearTarifa(admin, { clientId: c.cliente.id, modalidad: "FIJO", importe: "26853", vigenciaDesde: "2026-01-01" });
    const nuevas = await aumentoMasivo(admin, { clientId: c.cliente.id, porcentaje: 4, vigenciaDesde: "2026-05-01", motivo: "Ajuste mayo" });
    expect(nuevas[0].importe).toBe("27927.12");
    const todas = await listarTarifas(admin, { clientId: c.cliente.id });
    expect(todas.map((t) => [t.vigenciaDesde, t.vigenciaHasta])).toEqual([["2026-05-01", null], ["2026-01-01", "2026-04-30"]]);
  });
});

describe("catálogos", () => {
  it("sólo el administrador gestiona catálogos y se evitan duplicados", async () => {
    await expect(crearEnCatalogo(logistica, "choferes", { nombre: "Nuevo" })).rejects.toMatchObject({ codigo: "PROHIBIDO" });
    await crearEnCatalogo(admin, "vehiculos", { matricula: "abc 1234" });
    await expect(crearEnCatalogo(admin, "vehiculos", { matricula: "ABC 1234" })).rejects.toMatchObject({ codigo: "CONFLICTO" });
    expect((await listarCatalogo(admin, "vehiculos")).map((v) => v.matricula)).toEqual(["ABC 1234"]);
  });

  it("no elimina físicamente registros con viajes asociados: deben desactivarse", async () => {
    const c = await catalogoBase();
    await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c) });
    await expect(eliminarDeCatalogo(admin, "choferes", c.chofer.id)).rejects.toThrow(/Desactívelo/);
    const libre = await crearEnCatalogo(admin, "choferes", { nombre: "Sin viajes" });
    await eliminarDeCatalogo(admin, "choferes", libre.id as string);
    // Un registro desactivado no puede asignarse a un viaje nuevo.
    await prisma.driver.update({ where: { id: c.chofer.id }, data: { activo: false } });
    await expect(crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c) })).rejects.toThrow(/desactivado/);
  });
});
