import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errores";
import { crearTarifa, actualizarTarifa, nuevaVigencia } from "@/server/servicios/tarifas";
import { crearViaje, cerrarViaje, editarViaje, facturarViaje, anularViaje, previsualizar, obtenerViaje, listarViajes } from "@/server/servicios/viajes";
import { guardarConfiguracion, obtenerConfiguracion } from "@/server/servicios/configuracion";
import type { Actor } from "@/lib/permisos";
import { catalogoBase, crearActor, datosViaje, limpiarBase, type Catalogo } from "./helpers";

let admin: Actor;
let logistica: Actor;
let consulta: Actor;
let c: Catalogo;

async function tarifaPorTonelada(importe = "1500", extra: Record<string, unknown> = {}) {
  return crearTarifa(admin, {
    clientId: c.cliente.id,
    modalidad: "POR_PESO",
    importe,
    moneda: "UYU",
    unidad: "TONELADA",
    baseCalculo: "PROMEDIO",
    vigenciaDesde: "2026-01-01",
    ...extra,
  });
}

async function codigoError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.codigo;
    throw e;
  }
  return "OK";
}

beforeEach(async () => {
  await limpiarBase();
  admin = await crearActor("ADMIN", true);
  logistica = await crearActor("LOGISTICA");
  consulta = await crearActor("CONSULTA", true);
  c = await catalogoBase();
});

describe("registro de viajes", () => {
  it("(1) un usuario de logística puede crear un viaje y queda auditado", async () => {
    await tarifaPorTonelada();
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c) });
    expect(viaje.estado).toBe("ABIERTO");
    expect(viaje.creadoPor).toBe(logistica.nombre);
    expect(viaje.kgPromedio).toBe("995");
    expect(viaje.importeFacturado).toBe("1492.5");
    const logs = await prisma.tripAuditLog.findMany({ where: { tripId: viaje.id } });
    expect(logs.map((l) => l.accion)).toEqual(["CREAR"]);
  });

  it("(2) al seleccionar un cliente se obtiene la tarifa vigente", async () => {
    const vieja = await tarifaPorTonelada("1000");
    await nuevaVigencia(admin, vieja.id, { vigenciaDesde: "2026-05-01", importe: "1040", motivo: "Aumento 4 %" });
    const antes = await previsualizar(logistica, { fecha: "2026-04-30", clientId: c.cliente.id });
    const despues = await previsualizar(logistica, { fecha: "2026-06-15", clientId: c.cliente.id });
    expect(antes.resolucion).toMatchObject({ tipo: "OK", tarifa: { importe: "1000" } });
    expect(despues.resolucion).toMatchObject({ tipo: "OK", tarifa: { importe: "1040", modalidad: "POR_PESO", unidad: "TONELADA" } });
  });

  it("(4) facturación fija y (5) por kilogramos con la base configurada", async () => {
    await crearTarifa(admin, { clientId: c.cliente.id, modalidad: "FIJO", importe: "26853", vigenciaDesde: "2026-01-01" });
    await crearTarifa(admin, {
      clientId: c.otroCliente.id, modalidad: "POR_PESO", importe: "1.5", unidad: "KG", baseCalculo: "MENOR", vigenciaDesde: "2026-01-01",
    });
    const fijo = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c) });
    const porKg = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c, { clientId: c.otroCliente.id }) });
    expect(fijo.viaje.importeFacturado).toBe("26853");
    expect(porKg.viaje.kgBase).toBe("990");
    expect(porKg.viaje.importeFacturado).toBe("1485");
  });

  it("permite guardar un borrador incompleto pero no un viaje abierto incompleto", async () => {
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "BORRADOR", datos: { fecha: "2026-06-15" } });
    expect(viaje.estado).toBe("BORRADOR");
    expect(await codigoError(crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: { fecha: "2026-06-15" } }))).toBe("VALIDACION");
  });

  it("(7) no se puede cerrar un viaje sin tarifa vigente", async () => {
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c) });
    expect(viaje.tariffId).toBeNull();
    const err = await cerrarViaje(logistica, viaje.id, { version: viaje.version }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).detalles).toMatchObject({ errores: expect.arrayContaining(["No existe una tarifa vigente para este viaje."]) });
    expect(await codigoError(crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c) }))).toBe("VALIDACION");
  });

  it("no permite cerrar si faltan los kg que necesita la base de cálculo", async () => {
    await tarifaPorTonelada();
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c, { kgLlegada: null }) });
    expect(await codigoError(cerrarViaje(logistica, viaje.id, { version: viaje.version }))).toBe("VALIDACION");
  });

  it("exige observación cuando la diferencia supera el umbral, y bloquea sólo si se configura", async () => {
    await tarifaPorTonelada();
    const datos = datosViaje(c, { kgSalida: "1000", kgLlegada: "950" });
    const sinObs = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos });
    expect(sinObs.viaje.alertaDiferencia).toBe(true);
    expect(await codigoError(cerrarViaje(logistica, sinObs.viaje.id, { version: 1 }))).toBe("VALIDACION");
    const cerrado = await cerrarViaje(logistica, sinObs.viaje.id, { version: 1, observaciones: "Merma por humedad" });
    expect(cerrado.viaje.estado).toBe("CERRADO");

    await guardarConfiguracion(admin, { ...(await obtenerConfiguracion()), bloquearPorDiferencia: true });
    expect(await codigoError(crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: { ...datos, observaciones: "x" } }))).toBe("VALIDACION");
  });

  it("(13) un doble envío con la misma clave no duplica el viaje", async () => {
    await tarifaPorTonelada();
    const clave = randomUUID();
    const cuerpo = { idempotencyKey: clave, accion: "ABIERTO", datos: datosViaje(c) };
    const [a, b] = await Promise.all([crearViaje(logistica, cuerpo), crearViaje(logistica, cuerpo)]);
    const c3 = await crearViaje(logistica, cuerpo);
    expect(a.viaje.id).toBe(b.viaje.id);
    expect(c3.viaje.id).toBe(a.viaje.id);
    expect(c3.duplicado).toBe(true);
    expect(await prisma.trip.count()).toBe(1);
  });

  it("detecta modificaciones simultáneas (bloqueo optimista)", async () => {
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c) });
    await editarViaje(logistica, viaje.id, { datos: datosViaje(c, { kgSalida: "1001" }), version: 1 });
    expect(await codigoError(editarViaje(admin, viaje.id, { datos: datosViaje(c, { kgSalida: "1002" }), version: 1 }))).toBe("CONFLICTO");
  });
});

describe("tarifas y viajes cerrados", () => {
  it("(6) una modificación posterior del tarifario no cambia un viaje cerrado", async () => {
    const t = await tarifaPorTonelada("1500");
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c) });
    expect(viaje.importeFacturado).toBe("1492.5");
    expect(viaje.tarifaSnapshot).toMatchObject({ tarifa: { importe: "1500" } });

    // Edición directa del importe y nueva vigencia retroactiva no afectan el viaje cerrado.
    const actual = await prisma.tariff.findUniqueOrThrow({ where: { id: t.id } });
    await actualizarTarifa(admin, t.id, {
      datos: { clientId: c.cliente.id, modalidad: "POR_PESO", importe: "9999", unidad: "TONELADA", baseCalculo: "SALIDA", vigenciaDesde: "2026-01-01" },
      version: actual.version,
      motivo: "Corrección",
    });
    const despues = await obtenerViaje(admin, viaje.id);
    expect(despues.viaje.importeFacturado).toBe("1492.5");
    expect(despues.viaje.tarifaImporte).toBe("1500");

    // Incluso si un administrador edita los kg, se recalcula con la tarifa congelada.
    const editado = await editarViaje(admin, viaje.id, { datos: datosViaje(c, { kgSalida: "2000", kgLlegada: "2000" }), version: despues.viaje.version, motivo: "Corrección de pesada" });
    expect(editado.viaje.importeFacturado).toBe("3000");
    expect(editado.viaje.tarifaImporte).toBe("1500");
  });

  it("(8) rechaza vigencias superpuestas y no elige silenciosamente entre tarifas en conflicto", async () => {
    await tarifaPorTonelada("1500", { vigenciaHasta: "2026-06-30" });
    expect(await codigoError(tarifaPorTonelada("1600", { vigenciaDesde: "2026-06-30" }))).toBe("CONFLICTO");
    // Sin superposición sí se permite.
    await tarifaPorTonelada("1600", { vigenciaDesde: "2026-07-01" });

    // Un conflicto que entró por fuera de la validación (p. ej. datos previos) se informa como error de configuración.
    await prisma.tariff.create({
      data: { clientId: c.cliente.id, modalidad: "FIJO", importe: "100", vigenciaDesde: new Date("2026-01-01") },
    });
    const r = await previsualizar(logistica, { fecha: "2026-03-01", clientId: c.cliente.id });
    expect(r.resolucion?.tipo).toBe("CONFLICTO");
    expect(r.erroresCierre.join(" ")).toMatch(/Error de configuración/);
  });

  it("aplica la tarifa más específica", async () => {
    await tarifaPorTonelada("1000");
    await tarifaPorTonelada("1200", { cargoTypeId: c.carga.id });
    await tarifaPorTonelada("1300", { origenId: c.origen.id, destinoId: c.destino.id });
    const r = await previsualizar(logistica, datosViaje(c));
    expect(r.resolucion).toMatchObject({ tipo: "OK", nivel: 2, tarifa: { importe: "1300" } });
  });
});

describe("(14) auditoría de viajes cerrados", () => {
  it("toda modificación de un viaje cerrado exige motivo y queda registrada", async () => {
    await tarifaPorTonelada();
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c) });
    expect(await codigoError(editarViaje(admin, viaje.id, { datos: datosViaje(c, { kgSalida: "1100" }), version: viaje.version }))).toBe("VALIDACION");
    const r = await editarViaje(admin, viaje.id, { datos: datosViaje(c, { kgSalida: "1100", observaciones: "Merma en ruta" }), version: viaje.version, motivo: "Ticket de balanza corregido" });
    const f = await facturarViaje(admin, viaje.id, { version: r.viaje.version, numeroFactura: "A-1" });
    await anularViaje(admin, viaje.id, { version: f.viaje.version, motivo: "Factura anulada por el cliente" });
    const { historial } = await obtenerViaje(admin, viaje.id);
    expect(historial.map((h) => h.accion)).toEqual(["ANULAR", "FACTURAR", "EDITAR_CERRADO", "CREAR_Y_CERRAR"]);
    const edicion = historial.find((h) => h.accion === "EDITAR_CERRADO")!;
    expect(edicion.usuario).toBe(admin.nombre);
    expect(edicion.motivo).toBe("Ticket de balanza corregido");
    expect(edicion.cambios).toMatchObject({ kgSalida: { antes: "1000", despues: "1100" } });
  });
});

describe("(9) permisos en la capa de servicio", () => {
  it("impide acciones no autorizadas", async () => {
    await tarifaPorTonelada();
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c) });
    expect(await codigoError(crearViaje(consulta, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c) }))).toBe("PROHIBIDO");
    expect(await codigoError(editarViaje(logistica, viaje.id, { datos: datosViaje(c), version: viaje.version, motivo: "x" }))).toBe("PROHIBIDO");
    expect(await codigoError(anularViaje(logistica, viaje.id, { version: viaje.version, motivo: "no" }))).toBe("PROHIBIDO");
    expect(await codigoError(facturarViaje(consulta, viaje.id, { version: viaje.version }))).toBe("PROHIBIDO");
    expect(await codigoError(crearTarifa(logistica, {}))).toBe("PROHIBIDO");
  });

  it("el rol de consulta sólo ve viajes cerrados o facturados", async () => {
    await tarifaPorTonelada();
    const abierto = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c) });
    await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c) });
    const lista = await listarViajes(consulta, { estado: "ABIERTO" });
    expect(lista.items.every((v) => v.estado === "CERRADO" || v.estado === "FACTURADO")).toBe(true);
    expect(lista.total).toBe(0);
    expect((await listarViajes(consulta, {})).total).toBe(1);
    expect(await codigoError(obtenerViaje(consulta, abierto.viaje.id))).toBe("NO_ENCONTRADO");
  });
});
