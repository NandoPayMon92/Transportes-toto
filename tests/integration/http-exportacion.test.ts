import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/server/db";
import { crearTarifa } from "@/server/servicios/tarifas";
import { crearViaje } from "@/server/servicios/viajes";
import { iniciarSesion, generarTokenRestablecimiento, restablecerClave } from "@/server/servicios/auth";
import { actorDesdeToken } from "@/server/auth/sesion";
import * as rutaViajes from "@/app/api/viajes/route";
import * as rutaExportar from "@/app/api/viajes/exportar/route";
import * as rutaTarifas from "@/app/api/tarifas/route";
import * as rutaUsuarios from "@/app/api/usuarios/route";
import * as rutaAccion from "@/app/api/viajes/[id]/[accion]/route";
import * as rutaInformeExportar from "@/app/api/informes/exportar/route";
import type { Actor } from "@/lib/permisos";
import { catalogoBase, crearActor, ctx, datosViaje, limpiarBase, peticion, type Catalogo } from "./helpers";

let admin: Actor;
let logistica: Actor;
let logisticaExporta: Actor;
let consulta: Actor;
let c: Catalogo;

beforeEach(async () => {
  await limpiarBase();
  admin = await crearActor("ADMIN", true);
  logistica = await crearActor("LOGISTICA", false);
  logisticaExporta = await crearActor("LOGISTICA", true);
  consulta = await crearActor("CONSULTA", true);
  c = await catalogoBase();
  await crearTarifa(admin, { clientId: c.cliente.id, modalidad: "POR_PESO", importe: "1500", unidad: "TONELADA", baseCalculo: "PROMEDIO", vigenciaDesde: "2026-01-01" });
  await crearTarifa(admin, { clientId: c.otroCliente.id, modalidad: "FIJO", importe: "20000", vigenciaDesde: "2026-01-01" });
});

async function leerLibro(res: Response) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return wb;
}

describe("autenticación", () => {
  it("inicia sesión con contraseña correcta, rechaza la incorrecta y bloquea tras intentos fallidos", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: logistica.id } });
    const s = await iniciarSesion(u.usuario, "ClavePrueba123");
    expect((await actorDesdeToken(s.token))?.id).toBe(u.id);
    for (let i = 0; i < 5; i++) await expect(iniciarSesion(u.usuario, "incorrecta")).rejects.toThrow("Usuario o contraseña incorrectos.");
    await expect(iniciarSesion(u.usuario, "ClavePrueba123")).rejects.toThrow(/Demasiados intentos/);
  });

  it("no guarda la contraseña ni el token en claro", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(u.passwordHash).toMatch(/^scrypt\$/);
    const s = await iniciarSesion(u.usuario, "ClavePrueba123");
    expect(await prisma.session.findUnique({ where: { id: s.token } })).toBeNull();
  });

  it("el enlace de restablecimiento es de un solo uso", async () => {
    const { token } = await generarTokenRestablecimiento(logistica.id);
    await restablecerClave(token, "NuevaClave2026");
    await expect(restablecerClave(token, "OtraClave2026")).rejects.toThrow(/no es válido/);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: logistica.id } });
    await expect(iniciarSesion(u.usuario, "NuevaClave2026")).resolves.toBeTruthy();
  });
});

describe("(9) autorización en las rutas HTTP", () => {
  it("rechaza peticiones sin sesión", async () => {
    const res = await rutaViajes.GET(await peticion("/api/viajes"), ctx());
    expect(res.status).toBe(401);
  });

  it("devuelve 403 aunque el botón esté oculto en la interfaz", async () => {
    expect((await rutaViajes.POST(await peticion("/api/viajes", { actor: consulta, body: { datos: datosViaje(c), accion: "ABIERTO", idempotencyKey: randomUUID() } }), ctx())).status).toBe(403);
    expect((await rutaTarifas.POST(await peticion("/api/tarifas", { actor: logistica, body: {} }), ctx())).status).toBe(403);
    expect((await rutaUsuarios.GET(await peticion("/api/usuarios", { actor: logistica }), ctx())).status).toBe(403);
    expect((await rutaExportar.GET(await peticion("/api/viajes/exportar", { actor: logistica }), ctx())).status).toBe(403);
    const { viaje } = await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c) });
    const anular = await rutaAccion.POST(await peticion(`/api/viajes/${viaje.id}/anular`, { actor: logistica, body: { version: 1, motivo: "prueba" } }), ctx({ id: viaje.id, accion: "anular" }));
    expect(anular.status).toBe(403);
  });

  it("rechaza mutaciones desde otro origen (CSRF)", async () => {
    const req = await peticion("/api/viajes", { actor: logistica, body: { datos: datosViaje(c), accion: "ABIERTO", idempotencyKey: randomUUID() } });
    req.headers.set("origin", "https://sitio-malicioso.example");
    expect((await rutaViajes.POST(req, ctx())).status).toBe(403);
  });

  it("logística crea un viaje por HTTP y recibe errores de validación en español", async () => {
    const ok = await rutaViajes.POST(await peticion("/api/viajes", { actor: logistica, body: { datos: datosViaje(c), accion: "ABIERTO", idempotencyKey: randomUUID() } }), ctx());
    expect(ok.status).toBe(200);
    const mal = await rutaViajes.POST(await peticion("/api/viajes", { actor: logistica, body: { datos: { fecha: "2026-02-30", kgSalida: "abc" }, accion: "BORRADOR", idempotencyKey: randomUUID() } }), ctx());
    expect(mal.status).toBe(422);
    const cuerpo = await mal.json();
    expect(cuerpo.detalles.map((d: { mensaje: string }) => d.mensaje)).toEqual(
      expect.arrayContaining(["Fecha inválida (formato AAAA-MM-DD).", "Debe ser un número válido."]),
    );
  });
});

describe("exportación a Excel", () => {
  beforeEach(async () => {
    await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c, { fecha: "2026-06-10" }) });
    await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c, { fecha: "2026-06-20", vehicleId: c.vehiculo2.id }) });
    await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "CERRAR", datos: datosViaje(c, { fecha: "2026-06-12", clientId: c.otroCliente.id }) });
    await crearViaje(logistica, { idempotencyKey: randomUUID(), accion: "ABIERTO", datos: datosViaje(c, { fecha: "2026-07-01" }) });
  });

  it("(10) contiene únicamente los registros filtrados", async () => {
    const url = `/api/viajes/exportar?clientId=${c.cliente.id}&desde=2026-06-01&hasta=2026-06-30`;
    const res = await rutaExportar.GET(await peticion(url, { actor: admin }), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const ws = (await leerLibro(res)).getWorksheet("Viajes")!;
    expect(ws.rowCount).toBe(3); // encabezado + 2 viajes
    const clientes = [2, 3].map((r) => ws.getRow(r).getCell(3).value);
    expect(clientes).toEqual(["Paycueros SA", "Paycueros SA"]);

    const porMatricula = (await leerLibro(await rutaExportar.GET(await peticion(`/api/viajes/exportar?vehicleId=${c.vehiculo2.id}`, { actor: admin }), ctx()))).getWorksheet("Viajes")!;
    expect(porMatricula.rowCount).toBe(2);
    expect(porMatricula.getRow(2).getCell(4).value).toBe("TST1002");
  });

  it("respeta la visibilidad por rol: consulta no exporta viajes abiertos", async () => {
    const ws = (await leerLibro(await rutaExportar.GET(await peticion("/api/viajes/exportar", { actor: consulta }), ctx()))).getWorksheet("Viajes")!;
    expect(ws.rowCount).toBe(4);
    const wsLog = (await leerLibro(await rutaExportar.GET(await peticion("/api/viajes/exportar", { actor: logisticaExporta }), ctx()))).getWorksheet("Viajes")!;
    expect(wsLog.rowCount).toBe(5);
  });

  it("(11) exporta importes y kilogramos como números y la fecha como fecha", async () => {
    const res = await rutaExportar.GET(await peticion(`/api/viajes/exportar?clientId=${c.cliente.id}&desde=2026-06-10&hasta=2026-06-10`, { actor: admin }), ctx());
    const ws = (await leerLibro(res)).getWorksheet("Viajes")!;
    const enc = (ws.getRow(1).values as unknown[]).slice(1);
    const col = (nombre: string) => enc.indexOf(nombre) + 1;
    for (const h of ["ID del viaje", "Fecha", "Cliente", "Matrícula", "Chofer", "Carga", "Lugar de carga", "Lugar de descarga", "Kg de salida", "Kg de llegada", "Promedio de kg", "Diferencia de kg", "Porcentaje de diferencia (%)", "Modalidad de facturación", "Tarifa aplicada", "Base de cálculo", "Moneda", "Importe facturado", "Estado", "Observaciones"]) {
      expect(enc).toContain(h);
    }
    const fila = ws.getRow(2);
    expect(fila.getCell(col("Kg de salida")).value).toBe(1000);
    expect(fila.getCell(col("Promedio de kg")).value).toBe(995);
    expect(fila.getCell(col("Importe facturado")).value).toBe(1492.5);
    expect(fila.getCell(col("Tarifa aplicada")).value).toBe(1500);
    expect(typeof fila.getCell(col("Porcentaje de diferencia (%)")).value).toBe("number");
    expect(fila.getCell(col("Fecha")).value).toBeInstanceOf(Date);
    expect(fila.getCell(col("Estado")).value).toBe("Cerrado");
  });

  it("exporta informes con valores numéricos", async () => {
    const res = await rutaInformeExportar.GET(await peticion("/api/informes/exportar?agrupacion=cliente&desde=2026-01-01&hasta=2026-12-31", { actor: consulta }), ctx());
    expect(res.status).toBe(200);
    const ws = (await leerLibro(res)).getWorksheet("Informe")!;
    const filas = [2, 3].map((r) => ws.getRow(r).values as unknown[]);
    const pay = filas.find((f) => f[1] === "Paycueros SA")!;
    expect(pay[3]).toBe(2); // viajes cerrados (el abierto no se incluye)
    expect(typeof pay[10]).toBe("number");
  });
});
