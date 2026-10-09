import { Prisma, type Tariff } from "@prisma/client";
import { prisma, type Tx } from "@/server/db";
import { Conflicto, ErrorValidacion, NoEncontrado } from "@/server/errores";
import { exigir } from "./autorizacion";
import { diferencias, fecha } from "./util";
import type { Actor } from "@/lib/permisos";
import { BASES, MODALIDADES, MONEDAS, UNIDADES, type Base, type Modalidad, type Unidad } from "@/lib/domain/tipos";
import {
  detectarConflictos,
  mismaClave,
  nivelTarifa,
  NIVEL_ETIQUETA,
  seleccionarTarifa,
  vigenciasSuperpuestas,
  type CriterioViaje,
  type NivelTarifa,
  type TarifaClave,
} from "@/lib/domain/tarifas";
import { fechaADate, hoyUruguay, sumarDias } from "@/lib/fechas";
import * as D from "@/lib/domain/decimal";
import { z, zDecimal, zFecha, zId, zIdOpcional, zTextoOpcional } from "@/lib/validacion";

export const esquemaTarifa = z
  .object({
    clientId: zId,
    modalidad: z.enum(MODALIDADES),
    importe: zDecimal(4),
    moneda: z.enum(MONEDAS).default("UYU"),
    unidad: z.enum(UNIDADES).nullish().transform((v) => v ?? null),
    baseCalculo: z.enum(BASES).nullish().transform((v) => v ?? null),
    origenId: zIdOpcional,
    destinoId: zIdOpcional,
    cargoTypeId: zIdOpcional,
    vigenciaDesde: zFecha,
    vigenciaHasta: zFecha.nullish().or(z.literal("")).transform((v) => v || null),
    activo: z.boolean().default(true),
    observaciones: zTextoOpcional(500),
  })
  .superRefine((v, ctx) => {
    if (v.modalidad === "POR_PESO") {
      if (!v.unidad) ctx.addIssue({ code: "custom", path: ["unidad"], message: "Indique si la tarifa es por kg o por tonelada." });
      if (!v.baseCalculo) ctx.addIssue({ code: "custom", path: ["baseCalculo"], message: "Indique la base de cálculo." });
    }
    if (v.vigenciaHasta && v.vigenciaHasta < v.vigenciaDesde) {
      ctx.addIssue({ code: "custom", path: ["vigenciaHasta"], message: "La vigencia hasta no puede ser anterior a la vigencia desde." });
    }
    if (nivelTarifa(v) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["origenId"],
        message: "Combinación no admitida: indique origen y destino juntos (con o sin tipo de carga), sólo tipo de carga, o ninguno.",
      });
    }
  })
  .transform((v) => (v.modalidad === "FIJO" ? { ...v, unidad: null, baseCalculo: null } : v));

export type EntradaTarifa = z.infer<typeof esquemaTarifa>;

export const esquemaEdicionTarifa = z.object({
  datos: esquemaTarifa,
  version: z.number().int().positive(),
  motivo: z.string().trim().min(3, "Indique el motivo del cambio.").max(500),
});

export const esquemaNuevaVigencia = z.object({
  vigenciaDesde: zFecha,
  importe: zDecimal(4),
  motivo: z.string().trim().min(3, "Indique el motivo del cambio.").max(500),
});

export const esquemaAumento = z.object({
  clientId: zId,
  porcentaje: z.coerce.number().gt(-100, "El porcentaje debe ser mayor a -100.").max(1000),
  vigenciaDesde: zFecha,
  motivo: z.string().trim().min(3, "Indique el motivo del cambio.").max(500),
});

const incluir = {
  client: { select: { id: true, nombre: true } },
  origen: { select: { id: true, nombre: true } },
  destino: { select: { id: true, nombre: true } },
  cargoType: { select: { id: true, nombre: true } },
} satisfies Prisma.TariffInclude;

type TarifaConRel = Prisma.TariffGetPayload<{ include: typeof incluir }>;

export function dtoTarifa(t: TarifaConRel) {
  return {
    id: t.id,
    clientId: t.clientId,
    cliente: t.client.nombre,
    modalidad: t.modalidad as Modalidad,
    importe: t.importe.toString(),
    moneda: t.moneda,
    unidad: t.unidad as Unidad | null,
    baseCalculo: t.baseCalculo as Base | null,
    origenId: t.origenId,
    origen: t.origen?.nombre ?? null,
    destinoId: t.destinoId,
    destino: t.destino?.nombre ?? null,
    cargoTypeId: t.cargoTypeId,
    cargoType: t.cargoType?.nombre ?? null,
    vigenciaDesde: fecha(t.vigenciaDesde)!,
    vigenciaHasta: fecha(t.vigenciaHasta),
    activo: t.activo,
    observaciones: t.observaciones,
    version: t.version,
    reemplazaAId: t.reemplazaAId,
    nivel: nivelTarifa(t),
    updatedAt: t.updatedAt.toISOString(),
  };
}
export type TarifaDTO = ReturnType<typeof dtoTarifa>;

function clave(t: Pick<Tariff, "id" | "clientId" | "origenId" | "destinoId" | "cargoTypeId" | "vigenciaDesde" | "vigenciaHasta" | "activo">): TarifaClave {
  return {
    id: t.id,
    clientId: t.clientId,
    origenId: t.origenId,
    destinoId: t.destinoId,
    cargoTypeId: t.cargoTypeId,
    vigenciaDesde: fecha(t.vigenciaDesde)!,
    vigenciaHasta: fecha(t.vigenciaHasta),
    activo: t.activo,
  };
}

function datosPrisma(v: EntradaTarifa) {
  return {
    clientId: v.clientId,
    modalidad: v.modalidad,
    importe: new Prisma.Decimal(v.importe),
    moneda: v.moneda,
    unidad: v.unidad,
    baseCalculo: v.baseCalculo,
    origenId: v.origenId,
    destinoId: v.destinoId,
    cargoTypeId: v.cargoTypeId,
    vigenciaDesde: fechaADate(v.vigenciaDesde),
    vigenciaHasta: v.vigenciaHasta ? fechaADate(v.vigenciaHasta) : null,
    activo: v.activo,
    observaciones: v.observaciones,
  };
}

/** Bloquea las tarifas del cliente durante la transacción para evitar altas superpuestas concurrentes. */
async function bloquearCliente(tx: Tx, clientId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"tarifas:" + clientId}))`;
}

/** Rechaza la tarifa si se superpone con otra activa de la misma combinación. */
async function verificarSuperposicion(tx: Tx, v: EntradaTarifa, excluirId?: string) {
  if (!v.activo) return;
  const otras = await tx.tariff.findMany({
    where: {
      clientId: v.clientId,
      activo: true,
      origenId: v.origenId,
      destinoId: v.destinoId,
      cargoTypeId: v.cargoTypeId,
      ...(excluirId ? { NOT: { id: excluirId } } : {}),
    },
  });
  const nueva: TarifaClave = { id: excluirId ?? "nueva", ...v };
  const choque = otras.map(clave).find((o) => mismaClave(o, nueva) && vigenciasSuperpuestas(o, nueva));
  if (choque) {
    throw new Conflicto(
      `La vigencia se superpone con otra tarifa activa de la misma combinación (vigente desde ${choque.vigenciaDesde}${
        choque.vigenciaHasta ? ` hasta ${choque.vigenciaHasta}` : " sin fecha de fin"
      }). Ajuste las fechas o desactive la otra tarifa.`,
      { tarifaId: choque.id },
    );
  }
}

async function verificarReferencias(tx: Tx, v: EntradaTarifa) {
  const cliente = await tx.client.findUnique({ where: { id: v.clientId } });
  if (!cliente) throw new ErrorValidacion("El cliente no existe.");
  if (v.origenId && !(await tx.location.findUnique({ where: { id: v.origenId } }))) throw new ErrorValidacion("El lugar de carga no existe.");
  if (v.destinoId && !(await tx.location.findUnique({ where: { id: v.destinoId } }))) throw new ErrorValidacion("El lugar de descarga no existe.");
  if (v.cargoTypeId && !(await tx.cargoType.findUnique({ where: { id: v.cargoTypeId } }))) throw new ErrorValidacion("El tipo de carga no existe.");
}

export async function listarTarifas(actor: Actor, f: { clientId?: string; incluirInactivas?: boolean; vigentes?: boolean }) {
  exigir(actor, "tarifas.ver");
  const hoy = fechaADate(hoyUruguay());
  const tarifas = await prisma.tariff.findMany({
    where: {
      ...(f.clientId ? { clientId: f.clientId } : {}),
      ...(f.incluirInactivas ? {} : { activo: true }),
      ...(f.vigentes ? { vigenciaDesde: { lte: hoy }, OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: hoy } }] } : {}),
    },
    include: incluir,
    orderBy: [{ client: { nombre: "asc" } }, { vigenciaDesde: "desc" }],
    take: 2000,
  });
  return tarifas.map(dtoTarifa);
}

export async function obtenerTarifa(actor: Actor, id: string) {
  exigir(actor, "tarifas.ver");
  const t = await prisma.tariff.findUnique({ where: { id }, include: incluir });
  if (!t) throw new NoEncontrado("La tarifa no existe.");
  const [logs, versiones, viajes] = await Promise.all([
    prisma.tariffAuditLog.findMany({
      where: { tariffId: id },
      include: { user: { select: { nombre: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Cadena de vigencias de la misma combinación (historial de precios).
    prisma.tariff.findMany({
      where: { clientId: t.clientId, origenId: t.origenId, destinoId: t.destinoId, cargoTypeId: t.cargoTypeId },
      include: incluir,
      orderBy: { vigenciaDesde: "desc" },
    }),
    prisma.trip.count({ where: { tariffId: id } }),
  ]);
  return {
    tarifa: dtoTarifa(t),
    viajesAsociados: viajes,
    versiones: versiones.map(dtoTarifa),
    historial: logs.map((l) => ({
      id: l.id,
      accion: l.accion,
      motivo: l.motivo,
      cambios: l.cambios,
      usuario: l.user?.nombre ?? "Sistema",
      fecha: l.createdAt.toISOString(),
    })),
  };
}

export async function crearTarifa(actor: Actor, input: unknown, opciones: { tx?: Tx; motivo?: string } = {}) {
  exigir(actor, "tarifas.gestionar");
  const v = esquemaTarifa.parse(input);
  const ejecutar = async (tx: Tx) => {
    await verificarReferencias(tx, v);
    await bloquearCliente(tx, v.clientId);
    await verificarSuperposicion(tx, v);
    const t = await tx.tariff.create({
      data: { ...datosPrisma(v), createdById: actor.id, updatedById: actor.id },
      include: incluir,
    });
    await tx.tariffAuditLog.create({
      data: { tariffId: t.id, userId: actor.id, accion: "CREAR", motivo: opciones.motivo ?? null, cambios: dtoTarifa(t) as unknown as Prisma.InputJsonValue },
    });
    return dtoTarifa(t);
  };
  return opciones.tx ? ejecutar(opciones.tx) : prisma.$transaction(ejecutar);
}

export async function actualizarTarifa(actor: Actor, id: string, input: unknown) {
  exigir(actor, "tarifas.gestionar");
  const { datos: v, version, motivo } = esquemaEdicionTarifa.parse(input);
  return prisma.$transaction(async (tx) => {
    const actual = await tx.tariff.findUnique({ where: { id } });
    if (!actual) throw new NoEncontrado("La tarifa no existe.");
    if (actual.clientId !== v.clientId) throw new ErrorValidacion("No se puede cambiar el cliente de una tarifa. Cree una nueva.");
    await verificarReferencias(tx, v);
    await bloquearCliente(tx, v.clientId);
    await verificarSuperposicion(tx, v, id);
    const r = await tx.tariff.updateMany({
      where: { id, version },
      data: { ...datosPrisma(v), version: { increment: 1 }, updatedById: actor.id },
    });
    if (r.count === 0) throw new Conflicto("La tarifa fue modificada por otro usuario. Recargue la página e intente nuevamente.");
    const cambios = diferencias(actual as unknown as Record<string, unknown>, datosPrisma(v));
    const accion = actual.activo && !v.activo ? "DESACTIVAR" : !actual.activo && v.activo ? "ACTIVAR" : "EDITAR";
    await tx.tariffAuditLog.create({
      data: { tariffId: id, userId: actor.id, accion, motivo, cambios: cambios as Prisma.InputJsonValue },
    });
    // Los viajes cerrados no se tocan: conservan su copia de la tarifa aplicada.
    return dtoTarifa(await tx.tariff.findUniqueOrThrow({ where: { id }, include: incluir }));
  });
}

/**
 * Crea una nueva vigencia de precio: cierra la tarifa actual el día anterior y crea una nueva
 * con la misma combinación. Es la forma recomendada de actualizar precios (conserva el historial).
 */
export async function nuevaVigencia(actor: Actor, id: string, input: unknown, txExterna?: Tx) {
  exigir(actor, "tarifas.gestionar");
  const { vigenciaDesde, importe, motivo } = esquemaNuevaVigencia.parse(input);
  const ejecutar = async (tx: Tx) => {
    const actual = await tx.tariff.findUnique({ where: { id } });
    if (!actual) throw new NoEncontrado("La tarifa no existe.");
    if (!actual.activo) throw new ErrorValidacion("La tarifa está inactiva.");
    const desdeActual = fecha(actual.vigenciaDesde)!;
    if (vigenciaDesde <= desdeActual) {
      throw new ErrorValidacion(`La nueva vigencia debe comenzar después del ${desdeActual}.`);
    }
    const hastaActual = fecha(actual.vigenciaHasta);
    if (hastaActual && hastaActual < vigenciaDesde) {
      throw new ErrorValidacion("La tarifa ya finaliza antes de la nueva fecha. Cree una tarifa nueva.");
    }
    await bloquearCliente(tx, actual.clientId);
    const cierre = sumarDias(vigenciaDesde, -1);
    await tx.tariff.update({
      where: { id },
      data: { vigenciaHasta: fechaADate(cierre), version: { increment: 1 }, updatedById: actor.id },
    });
    await tx.tariffAuditLog.create({
      data: {
        tariffId: id,
        userId: actor.id,
        accion: "CERRAR_VIGENCIA",
        motivo,
        cambios: { vigenciaHasta: { antes: hastaActual, despues: cierre } },
      },
    });
    const nueva = await tx.tariff.create({
      data: {
        clientId: actual.clientId,
        modalidad: actual.modalidad,
        importe: new Prisma.Decimal(importe),
        moneda: actual.moneda,
        unidad: actual.unidad,
        baseCalculo: actual.baseCalculo,
        origenId: actual.origenId,
        destinoId: actual.destinoId,
        cargoTypeId: actual.cargoTypeId,
        vigenciaDesde: fechaADate(vigenciaDesde),
        vigenciaHasta: actual.vigenciaHasta,
        activo: true,
        observaciones: actual.observaciones,
        reemplazaAId: actual.id,
        createdById: actor.id,
        updatedById: actor.id,
      },
      include: incluir,
    });
    await tx.tariffAuditLog.create({
      data: {
        tariffId: nueva.id,
        userId: actor.id,
        accion: "NUEVA_VIGENCIA",
        motivo,
        cambios: { importe: { antes: actual.importe.toString(), despues: nueva.importe.toString() }, reemplazaA: actual.id },
      },
    });
    return dtoTarifa(nueva);
  };
  return txExterna ? ejecutar(txExterna) : prisma.$transaction(ejecutar);
}

/** Aplica un aumento porcentual a todas las tarifas activas de un cliente vigentes en la fecha indicada. */
export async function aumentoMasivo(actor: Actor, input: unknown) {
  exigir(actor, "tarifas.gestionar");
  const { clientId, porcentaje, vigenciaDesde, motivo } = esquemaAumento.parse(input);
  const factor = D.add(D.parseFixed("1"), D.div(D.parseFixed(porcentaje), D.parseFixed("100"), 6));
  return prisma.$transaction(async (tx) => {
    const fechaD = fechaADate(vigenciaDesde);
    const tarifas = await tx.tariff.findMany({
      where: {
        clientId,
        activo: true,
        vigenciaDesde: { lt: fechaD },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaD } }],
      },
    });
    if (tarifas.length === 0) throw new ErrorValidacion("El cliente no tiene tarifas vigentes a esa fecha para actualizar.");
    const creadas = [];
    for (const t of tarifas) {
      const decimales = t.unidad === "KG" ? 4 : 2;
      const importe = D.toFixedString(D.mul(D.parseFixed(t.importe.toString()), factor), decimales);
      creadas.push(await nuevaVigencia(actor, t.id, { vigenciaDesde, importe, motivo: `${motivo} (${porcentaje} %)` }, tx));
    }
    return creadas;
  }, { timeout: 60_000 });
}

export type ResultadoResolucion =
  | { tipo: "OK"; tarifa: TarifaDTO; nivel: NivelTarifa; nivelEtiqueta: string }
  | { tipo: "SIN_TARIFA"; mensaje: string }
  | { tipo: "CONFLICTO"; mensaje: string; tarifas: TarifaDTO[] };

/** Busca la tarifa vigente más específica para un viaje. */
export async function resolverTarifa(criterio: CriterioViaje, db: Tx = prisma): Promise<ResultadoResolucion> {
  const fechaD = fechaADate(criterio.fecha);
  const candidatas = await db.tariff.findMany({
    where: {
      clientId: criterio.clientId,
      activo: true,
      vigenciaDesde: { lte: fechaD },
      OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaD } }],
    },
    include: incluir,
  });
  const r = seleccionarTarifa(
    candidatas.map((t) => ({ ...clave(t), t })),
    criterio,
  );
  if (r.tipo === "OK") return { tipo: "OK", tarifa: dtoTarifa(r.tarifa.t), nivel: r.nivel, nivelEtiqueta: NIVEL_ETIQUETA[r.nivel] };
  if (r.tipo === "CONFLICTO") {
    return {
      tipo: "CONFLICTO",
      mensaje: `Error de configuración: hay ${r.tarifas.length} tarifas igual de específicas (${NIVEL_ETIQUETA[r.nivel]}) vigentes para este viaje. El administrador debe corregir el tarifario.`,
      tarifas: r.tarifas.map((x) => dtoTarifa(x.t)),
    };
  }
  return { tipo: "SIN_TARIFA", mensaje: "No hay una tarifa vigente para este cliente en la fecha del viaje." };
}

export async function simularTarifa(actor: Actor, criterio: CriterioViaje) {
  exigir(actor, "tarifas.ver");
  return resolverTarifa(criterio);
}

/** Problemas de configuración del tarifario: superposiciones y clientes activos sin tarifa vigente. */
export async function diagnosticoTarifario(actor: Actor) {
  exigir(actor, "tarifas.ver");
  const todas = await prisma.tariff.findMany({ where: { activo: true }, include: incluir });
  const pares = detectarConflictos(todas.map((t) => ({ ...clave(t), t })));
  const hoy = hoyUruguay();
  const clientes = await prisma.client.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
  const conVigente = new Set(
    todas
      .filter((t) => fecha(t.vigenciaDesde)! <= hoy && (!t.vigenciaHasta || fecha(t.vigenciaHasta)! >= hoy))
      .map((t) => t.clientId),
  );
  return {
    conflictos: pares.map(([a, b]) => ({ a: dtoTarifa(a.t), b: dtoTarifa(b.t) })),
    clientesSinTarifa: clientes.filter((c) => !conVigente.has(c.id)).map((c) => ({ id: c.id, nombre: c.nombre })),
  };
}

