import { Prisma, type EstadoViaje } from "@prisma/client";
import { prisma, type Tx } from "@/server/db";
import { Conflicto, ErrorValidacion, NoEncontrado, Prohibido } from "@/server/errores";
import { exigir } from "./autorizacion";
import { obtenerConfiguracion } from "./configuracion";
import { resolverTarifa, type ResultadoResolucion } from "./tarifas";
import { dec, diferencias, fecha } from "./util";
import { tienePermiso, type Actor } from "@/lib/permisos";
import { calcularViaje, type ResultadoCalculo } from "@/lib/domain/calculos";
import type { Base, ConfiguracionCalculo, Estado, Modalidad, TarifaCalculo, Unidad } from "@/lib/domain/tipos";
import { ESTADOS, MODALIDADES } from "@/lib/domain/tipos";
import { fechaADate } from "@/lib/fechas";
import {
  z,
  zDecimalOpcional,
  zEnteroOpcional,
  zFecha,
  zIdOpcional,
  zTextoOpcional,
} from "@/lib/validacion";

// ---------------------------------------------------------------------------
// Esquemas de entrada
// ---------------------------------------------------------------------------

export const esquemaDatosViaje = z.object({
  fecha: zFecha,
  vehicleId: zIdOpcional,
  clientId: zIdOpcional,
  driverId: zIdOpcional,
  cargoTypeId: zIdOpcional,
  cargaDetalle: zTextoOpcional(200),
  origenId: zIdOpcional,
  destinoId: zIdOpcional,
  kgSalida: zDecimalOpcional(2),
  kgLlegada: zDecimalOpcional(2),
  numeroOrden: zTextoOpcional(50),
  numeroPesada: zTextoOpcional(50),
  viaticos: zEnteroOpcional,
  estadias: zEnteroOpcional,
  liquidacionCliente: zDecimalOpcional(2),
  observaciones: zTextoOpcional(1000),
});
export type DatosViaje = z.infer<typeof esquemaDatosViaje>;

export const esquemaCrearViaje = z.object({
  datos: esquemaDatosViaje,
  accion: z.enum(["BORRADOR", "ABIERTO", "CERRAR"]),
  idempotencyKey: z.string().uuid("Clave de envío inválida."),
});

export const esquemaEditarViaje = z.object({
  datos: esquemaDatosViaje,
  version: z.number().int().positive(),
  accion: z.enum(["BORRADOR", "ABIERTO", "GUARDAR"]).default("GUARDAR"),
  motivo: zTextoOpcional(500),
  reaplicarTarifa: z.boolean().default(false),
});

export const esquemaCerrar = z.object({ version: z.number().int().positive(), observaciones: zTextoOpcional(1000) });
export const esquemaFacturar = z.object({
  version: z.number().int().positive(),
  numeroFactura: zTextoOpcional(50),
  fechaFactura: zFecha.nullish().or(z.literal("")).transform((v) => v || null),
});
export const esquemaMotivo = z.object({
  version: z.number().int().positive(),
  motivo: z.string().trim().min(3, "Indique el motivo.").max(500),
});

export const esquemaPrevisualizar = esquemaDatosViaje.partial().extend({ fecha: zFecha });

// ---------------------------------------------------------------------------
// Consultas y DTO
// ---------------------------------------------------------------------------

const incluir = {
  vehicle: { select: { id: true, matricula: true, activo: true } },
  client: { select: { id: true, nombre: true, activo: true } },
  driver: { select: { id: true, nombre: true, activo: true } },
  cargoType: { select: { id: true, nombre: true, activo: true } },
  origen: { select: { id: true, nombre: true, activo: true } },
  destino: { select: { id: true, nombre: true, activo: true } },
  createdBy: { select: { nombre: true } },
  updatedBy: { select: { nombre: true } },
  closedBy: { select: { nombre: true } },
} satisfies Prisma.TripInclude;

type ViajeConRel = Prisma.TripGetPayload<{ include: typeof incluir }>;

const ESTADOS_EDITABLES: EstadoViaje[] = ["BORRADOR", "ABIERTO"];
const ESTADOS_CERRADOS: EstadoViaje[] = ["CERRADO", "FACTURADO"];

export function accionesPermitidas(actor: Actor, estado: EstadoViaje) {
  const abierto = ESTADOS_EDITABLES.includes(estado);
  const cerrado = ESTADOS_CERRADOS.includes(estado);
  return {
    editar: (abierto && tienePermiso(actor, "viajes.editarAbierto")) || (cerrado && tienePermiso(actor, "viajes.editarCerrado")),
    cerrar: abierto && tienePermiso(actor, "viajes.cerrar"),
    facturar: estado === "CERRADO" && tienePermiso(actor, "viajes.facturar"),
    reabrir: estado === "CERRADO" && tienePermiso(actor, "viajes.reabrir"),
    anular: estado !== "ANULADO" && tienePermiso(actor, "viajes.anular"),
  };
}

export function dtoViaje(v: ViajeConRel, actor: Actor) {
  return {
    id: v.id,
    numero: v.numero,
    fecha: fecha(v.fecha)!,
    vehicleId: v.vehicleId,
    matricula: v.vehicle?.matricula ?? null,
    clientId: v.clientId,
    cliente: v.client?.nombre ?? null,
    driverId: v.driverId,
    chofer: v.driver?.nombre ?? null,
    cargoTypeId: v.cargoTypeId,
    cargoType: v.cargoType?.nombre ?? null,
    cargaDetalle: v.cargaDetalle,
    carga: [v.cargoType?.nombre, v.cargaDetalle].filter(Boolean).join(" – ") || null,
    origenId: v.origenId,
    origen: v.origen?.nombre ?? null,
    destinoId: v.destinoId,
    destino: v.destino?.nombre ?? null,
    kgSalida: dec(v.kgSalida),
    kgLlegada: dec(v.kgLlegada),
    kgPromedio: dec(v.kgPromedio),
    kgDiferencia: dec(v.kgDiferencia),
    porcentajeDiferencia: dec(v.porcentajeDiferencia),
    kgBase: dec(v.kgBase),
    alertaDiferencia: v.alertaDiferencia,
    numeroOrden: v.numeroOrden,
    numeroPesada: v.numeroPesada,
    viaticos: v.viaticos,
    estadias: v.estadias,
    liquidacionCliente: dec(v.liquidacionCliente),
    tariffId: v.tariffId,
    tarifaModalidad: v.tarifaModalidad as Modalidad | null,
    tarifaImporte: dec(v.tarifaImporte),
    tarifaUnidad: v.tarifaUnidad as Unidad | null,
    tarifaBase: v.tarifaBase as Base | null,
    tarifaVigenciaDesde: fecha(v.tarifaVigenciaDesde),
    tarifaSnapshot: v.tarifaSnapshot,
    moneda: v.moneda,
    importeFacturado: dec(v.importeFacturado),
    estado: v.estado as Estado,
    observaciones: v.observaciones,
    motivoAnulacion: v.motivoAnulacion,
    numeroFactura: v.numeroFactura,
    fechaFactura: fecha(v.fechaFactura),
    version: v.version,
    creadoPor: v.createdBy.nombre,
    creadoEn: v.createdAt.toISOString(),
    modificadoPor: v.updatedBy.nombre,
    modificadoEn: v.updatedAt.toISOString(),
    cerradoPor: v.closedBy?.nombre ?? null,
    cerradoEn: v.closedAt?.toISOString() ?? null,
    acciones: accionesPermitidas(actor, v.estado),
  };
}
export type ViajeDTO = ReturnType<typeof dtoViaje>;

/** Valores legibles para el historial de cambios. */
function auditable(v: ViajeConRel) {
  return {
    fecha: fecha(v.fecha),
    matricula: v.vehicle?.matricula ?? null,
    cliente: v.client?.nombre ?? null,
    chofer: v.driver?.nombre ?? null,
    tipoCarga: v.cargoType?.nombre ?? null,
    cargaDetalle: v.cargaDetalle,
    lugarCarga: v.origen?.nombre ?? null,
    lugarDescarga: v.destino?.nombre ?? null,
    kgSalida: dec(v.kgSalida),
    kgLlegada: dec(v.kgLlegada),
    tarifa: dec(v.tarifaImporte),
    modalidad: v.tarifaModalidad,
    importeFacturado: dec(v.importeFacturado),
    numeroOrden: v.numeroOrden,
    numeroPesada: v.numeroPesada,
    viaticos: v.viaticos,
    estadias: v.estadias,
    liquidacionCliente: dec(v.liquidacionCliente),
    numeroFactura: v.numeroFactura,
    fechaFactura: fecha(v.fechaFactura),
    observaciones: v.observaciones,
  };
}

// ---------------------------------------------------------------------------
// Preparación y validación
// ---------------------------------------------------------------------------

export interface Preparado {
  resolucion: ResultadoResolucion | null;
  tarifa: TarifaCalculo | null;
  tarifaInfo: { id: string; vigenciaDesde: string } | null;
  calculo: ResultadoCalculo;
}

function tarifaDesdeSnapshot(v: ViajeConRel): Preparado["tarifa"] {
  if (!v.tarifaModalidad || !v.tarifaImporte) return null;
  return {
    modalidad: v.tarifaModalidad as Modalidad,
    importe: v.tarifaImporte.toString(),
    unidad: v.tarifaUnidad as Unidad | null,
    baseCalculo: v.tarifaBase as Base | null,
    moneda: v.moneda,
  };
}

/** Resuelve la tarifa vigente (o usa la congelada) y calcula kilos e importe. */
export async function preparar(
  db: Tx,
  datos: Partial<DatosViaje> & { fecha: string },
  config: ConfiguracionCalculo,
  congelada?: { tarifa: TarifaCalculo | null; info: Preparado["tarifaInfo"] },
): Promise<Preparado> {
  let resolucion: ResultadoResolucion | null = null;
  let tarifa: TarifaCalculo | null = null;
  let tarifaInfo: Preparado["tarifaInfo"] = null;
  if (congelada) {
    tarifa = congelada.tarifa;
    tarifaInfo = congelada.info;
  } else if (datos.clientId) {
    resolucion = await resolverTarifa(
      {
        clientId: datos.clientId,
        fecha: datos.fecha,
        origenId: datos.origenId ?? null,
        destinoId: datos.destinoId ?? null,
        cargoTypeId: datos.cargoTypeId ?? null,
      },
      db,
    );
    if (resolucion.tipo === "OK") {
      const t = resolucion.tarifa;
      tarifa = { modalidad: t.modalidad, importe: t.importe, unidad: t.unidad, baseCalculo: t.baseCalculo, moneda: t.moneda };
      tarifaInfo = { id: t.id, vigenciaDesde: t.vigenciaDesde };
    }
  }
  const calculo = calcularViaje(
    { kgSalida: datos.kgSalida ?? null, kgLlegada: datos.kgLlegada ?? null, tarifa },
    config,
  );
  return { resolucion, tarifa, tarifaInfo, calculo };
}

const CAMPOS_OBLIGATORIOS: Array<[keyof DatosViaje, string]> = [
  ["vehicleId", "la matrícula"],
  ["clientId", "el cliente"],
  ["driverId", "el chofer"],
  ["origenId", "el lugar de carga"],
  ["destinoId", "el lugar de descarga"],
];

export function faltantesOperativos(d: Partial<DatosViaje>): string[] {
  const faltan = CAMPOS_OBLIGATORIOS.filter(([k]) => !d[k]).map(([, n]) => n);
  if (!d.cargoTypeId && !d.cargaDetalle) faltan.push("la carga");
  return faltan;
}

/** Errores que impiden cerrar el viaje (lista vacía = se puede cerrar). */
export function erroresCierre(d: Partial<DatosViaje>, p: Preparado, config: ConfiguracionCalculo): string[] {
  const errores: string[] = [];
  const faltan = faltantesOperativos(d);
  if (faltan.length) errores.push(`Falta completar: ${faltan.join(", ")}.`);
  if (p.resolucion?.tipo === "CONFLICTO") errores.push(p.resolucion.mensaje);
  else if (!p.tarifa) errores.push("No existe una tarifa vigente para este viaje.");
  errores.push(...p.calculo.problemas.filter((x) => !x.startsWith("No hay una tarifa")));
  if (config.exigirAmbosPesos && (!d.kgSalida || !d.kgLlegada)) {
    errores.push("La configuración exige ingresar los kg de salida y de llegada.");
  }
  if (p.calculo.alertaDiferencia) {
    if (config.bloquearPorDiferencia) {
      errores.push(`La diferencia de peso supera el ${config.umbralDiferenciaPct} % y la configuración impide cerrar el viaje.`);
    } else if (config.observacionObligatoriaPorDiferencia && !d.observaciones) {
      errores.push(`La diferencia de peso supera el ${config.umbralDiferenciaPct} %: agregue una observación explicando el motivo.`);
    }
  }
  return errores;
}

/** Verifica que las referencias existan y que no se asignen registros inactivos nuevos. */
async function verificarReferencias(db: Tx, d: Partial<DatosViaje>, anterior?: ViajeConRel) {
  const checks: Array<[string | null | undefined, string | null | undefined, () => Promise<{ activo: boolean } | null>, string]> = [
    [d.vehicleId, anterior?.vehicleId, () => db.vehicle.findUnique({ where: { id: d.vehicleId! } }), "La matrícula"],
    [d.clientId, anterior?.clientId, () => db.client.findUnique({ where: { id: d.clientId! } }), "El cliente"],
    [d.driverId, anterior?.driverId, () => db.driver.findUnique({ where: { id: d.driverId! } }), "El chofer"],
    [d.cargoTypeId, anterior?.cargoTypeId, () => db.cargoType.findUnique({ where: { id: d.cargoTypeId! } }), "El tipo de carga"],
    [d.origenId, anterior?.origenId, () => db.location.findUnique({ where: { id: d.origenId! } }), "El lugar de carga"],
    [d.destinoId, anterior?.destinoId, () => db.location.findUnique({ where: { id: d.destinoId! } }), "El lugar de descarga"],
  ];
  for (const [nuevo, previo, buscar, nombre] of checks) {
    if (!nuevo) continue;
    const r = await buscar();
    if (!r) throw new ErrorValidacion(`${nombre} seleccionado no existe.`);
    if (!r.activo && nuevo !== previo) throw new ErrorValidacion(`${nombre} seleccionado está desactivado.`);
  }
}

function datosPersistibles(d: DatosViaje, p: Preparado) {
  const c = p.calculo;
  const decOrNull = (s: string | null | undefined) => (s === null || s === undefined ? null : new Prisma.Decimal(s));
  return {
    fecha: fechaADate(d.fecha),
    vehicleId: d.vehicleId,
    clientId: d.clientId,
    driverId: d.driverId,
    cargoTypeId: d.cargoTypeId,
    cargaDetalle: d.cargaDetalle,
    origenId: d.origenId,
    destinoId: d.destinoId,
    kgSalida: decOrNull(c.kgSalida),
    kgLlegada: decOrNull(c.kgLlegada),
    kgPromedio: decOrNull(c.kgPromedio),
    kgDiferencia: decOrNull(c.kgDiferencia),
    porcentajeDiferencia: decOrNull(c.porcentajeDiferencia),
    kgBase: decOrNull(c.kgBase),
    alertaDiferencia: c.alertaDiferencia,
    numeroOrden: d.numeroOrden,
    numeroPesada: d.numeroPesada,
    viaticos: d.viaticos,
    estadias: d.estadias,
    liquidacionCliente: decOrNull(d.liquidacionCliente),
    observaciones: d.observaciones,
    tariffId: p.tarifaInfo?.id ?? null,
    tarifaModalidad: p.tarifa?.modalidad ?? null,
    tarifaImporte: decOrNull(p.tarifa?.importe),
    tarifaUnidad: p.tarifa?.unidad ?? null,
    tarifaBase: p.tarifa?.baseCalculo ?? null,
    tarifaVigenciaDesde: p.tarifaInfo ? fechaADate(p.tarifaInfo.vigenciaDesde) : null,
    moneda: p.tarifa?.moneda ?? "UYU",
    importeFacturado: decOrNull(c.importe),
  };
}

function snapshotCierre(p: Preparado, actor: Actor) {
  return {
    ...(p.resolucion?.tipo === "OK"
      ? { tarifa: p.resolucion.tarifa, nivel: p.resolucion.nivel, nivelEtiqueta: p.resolucion.nivelEtiqueta }
      : { tarifa: p.tarifa, tarifaId: p.tarifaInfo?.id ?? null }),
    congeladaEn: new Date().toISOString(),
    congeladaPor: actor.nombre,
  } as unknown as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

export async function previsualizar(actor: Actor, input: unknown) {
  if (!tienePermiso(actor, "viajes.crear") && !tienePermiso(actor, "viajes.editarCerrado")) throw new Prohibido();
  const d = esquemaPrevisualizar.parse(input);
  const config = await obtenerConfiguracion();
  const p = await preparar(prisma, d, config);
  return {
    resolucion: p.resolucion,
    calculo: p.calculo,
    erroresCierre: erroresCierre(d, p, config),
    config: { umbralDiferenciaPct: config.umbralDiferenciaPct, observacionObligatoriaPorDiferencia: config.observacionObligatoriaPorDiferencia },
  };
}

async function cargar(db: Tx, id: string) {
  const v = await db.trip.findUnique({ where: { id }, include: incluir });
  if (!v) throw new NoEncontrado("El viaje no existe.");
  return v;
}

function puedeVer(actor: Actor, estado: EstadoViaje) {
  return tienePermiso(actor, "viajes.verTodos") || ESTADOS_CERRADOS.includes(estado);
}

export async function obtenerViaje(actor: Actor, id: string) {
  const v = await cargar(prisma, id);
  if (!puedeVer(actor, v.estado)) throw new NoEncontrado("El viaje no existe.");
  const logs = await prisma.tripAuditLog.findMany({
    where: { tripId: id },
    include: { user: { select: { nombre: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    viaje: dtoViaje(v, actor),
    historial: logs.map((l) => ({
      id: l.id,
      accion: l.accion,
      estadoAnterior: l.estadoAnterior,
      estadoNuevo: l.estadoNuevo,
      motivo: l.motivo,
      cambios: l.cambios,
      usuario: l.user.nombre,
      fecha: l.createdAt.toISOString(),
    })),
  };
}

export async function crearViaje(actor: Actor, input: unknown) {
  exigir(actor, "viajes.crear");
  const { datos, accion, idempotencyKey } = esquemaCrearViaje.parse(input);

  // Doble envío: si ya existe un viaje con esta clave, se devuelve el mismo.
  const previo = await prisma.trip.findUnique({ where: { idempotencyKey }, include: incluir });
  if (previo) {
    if (previo.createdById !== actor.id) throw new Conflicto("Clave de envío ya utilizada.");
    return { viaje: dtoViaje(previo, actor), duplicado: true };
  }

  const config = await obtenerConfiguracion();
  try {
    const viaje = await prisma.$transaction(async (tx) => {
      await verificarReferencias(tx, datos);
      const p = await preparar(tx, datos, config);
      let estado: EstadoViaje = "BORRADOR";
      if (accion !== "BORRADOR") {
        const faltan = faltantesOperativos(datos);
        if (faltan.length) throw new ErrorValidacion(`Para guardar el viaje falta completar: ${faltan.join(", ")}. Puede guardarlo como borrador.`);
        estado = "ABIERTO";
      }
      if (accion === "CERRAR") {
        if (!tienePermiso(actor, "viajes.cerrar")) throw new Prohibido();
        const errores = erroresCierre(datos, p, config);
        if (errores.length) throw new ErrorValidacion("No se puede cerrar el viaje.", { errores });
        estado = "CERRADO";
      }
      const creado = await tx.trip.create({
        data: {
          ...datosPersistibles(datos, p),
          estado,
          idempotencyKey,
          createdById: actor.id,
          updatedById: actor.id,
          ...(estado === "CERRADO" ? { closedAt: new Date(), closedById: actor.id, tarifaSnapshot: snapshotCierre(p, actor) } : {}),
        },
        include: incluir,
      });
      await tx.tripAuditLog.create({
        data: {
          tripId: creado.id,
          userId: actor.id,
          accion: estado === "CERRADO" ? "CREAR_Y_CERRAR" : "CREAR",
          estadoNuevo: estado,
          cambios: auditable(creado) as Prisma.InputJsonValue,
        },
      });
      return creado;
    });
    return { viaje: dtoViaje(viaje, actor), duplicado: false };
  } catch (e) {
    // Carrera entre dos envíos simultáneos con la misma clave.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existente = await prisma.trip.findUnique({ where: { idempotencyKey }, include: incluir });
      if (existente) return { viaje: dtoViaje(existente, actor), duplicado: true };
    }
    throw e;
  }
}

async function actualizarConVersion(tx: Tx, id: string, version: number, data: Prisma.TripUncheckedUpdateManyInput) {
  const r = await tx.trip.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  if (r.count === 0) {
    throw new Conflicto("El viaje fue modificado por otro usuario. Recargue la página para ver los cambios e intente nuevamente.");
  }
}

export async function editarViaje(actor: Actor, id: string, input: unknown) {
  const { datos, version, accion, motivo, reaplicarTarifa } = esquemaEditarViaje.parse(input);
  const config = await obtenerConfiguracion();
  const viaje = await prisma.$transaction(async (tx) => {
    const actual = await cargar(tx, id);
    if (!puedeVer(actor, actual.estado)) throw new NoEncontrado("El viaje no existe.");
    if (actual.estado === "ANULADO") throw new ErrorValidacion("Un viaje anulado no puede modificarse.");
    const cerrado = ESTADOS_CERRADOS.includes(actual.estado);
    if (cerrado) {
      exigir(actor, "viajes.editarCerrado");
      if (!motivo) throw new ErrorValidacion("Indique el motivo de la modificación de un viaje cerrado.");
    } else {
      exigir(actor, "viajes.editarAbierto");
    }
    await verificarReferencias(tx, datos, actual);

    // En viajes cerrados se conserva la tarifa congelada salvo que el administrador pida reaplicarla.
    const congelada =
      cerrado && !reaplicarTarifa
        ? {
            tarifa: tarifaDesdeSnapshot(actual),
            info: actual.tariffId && actual.tarifaVigenciaDesde ? { id: actual.tariffId, vigenciaDesde: fecha(actual.tarifaVigenciaDesde)! } : null,
          }
        : undefined;
    const p = await preparar(tx, datos, config, congelada);

    let estado: EstadoViaje = actual.estado;
    if (!cerrado) {
      if (accion === "BORRADOR") estado = "BORRADOR";
      else if (accion === "ABIERTO" || actual.estado === "ABIERTO") {
        const faltan = faltantesOperativos(datos);
        if (faltan.length) throw new ErrorValidacion(`Para guardar el viaje falta completar: ${faltan.join(", ")}. Puede guardarlo como borrador.`);
        estado = "ABIERTO";
      }
    } else {
      const errores = erroresCierre(datos, p, config);
      if (errores.length) throw new ErrorValidacion("Con estos datos el viaje no cumple las condiciones de cierre.", { errores });
    }

    await actualizarConVersion(tx, id, version, {
      ...datosPersistibles(datos, p),
      estado,
      updatedById: actor.id,
      ...(cerrado && reaplicarTarifa ? { tarifaSnapshot: snapshotCierre(p, actor) } : {}),
    });
    const nuevo = await cargar(tx, id);
    const cambios = diferencias(auditable(actual), auditable(nuevo));
    if (Object.keys(cambios).length || estado !== actual.estado) {
      await tx.tripAuditLog.create({
        data: {
          tripId: id,
          userId: actor.id,
          accion: cerrado ? (reaplicarTarifa ? "EDITAR_CERRADO_REAPLICAR_TARIFA" : "EDITAR_CERRADO") : "EDITAR",
          estadoAnterior: actual.estado,
          estadoNuevo: estado,
          motivo,
          cambios: cambios as Prisma.InputJsonValue,
        },
      });
    }
    return nuevo;
  });
  return { viaje: dtoViaje(viaje, actor) };
}

function datosDe(v: ViajeConRel): DatosViaje {
  return {
    fecha: fecha(v.fecha)!,
    vehicleId: v.vehicleId,
    clientId: v.clientId,
    driverId: v.driverId,
    cargoTypeId: v.cargoTypeId,
    cargaDetalle: v.cargaDetalle,
    origenId: v.origenId,
    destinoId: v.destinoId,
    kgSalida: dec(v.kgSalida),
    kgLlegada: dec(v.kgLlegada),
    numeroOrden: v.numeroOrden,
    numeroPesada: v.numeroPesada,
    viaticos: v.viaticos,
    estadias: v.estadias,
    liquidacionCliente: dec(v.liquidacionCliente),
    observaciones: v.observaciones,
  };
}

/** Cierra el viaje: recalcula con la tarifa vigente y guarda una copia inmutable de ella. */
export async function cerrarViaje(actor: Actor, id: string, input: unknown) {
  exigir(actor, "viajes.cerrar");
  const { version, observaciones } = esquemaCerrar.parse(input);
  const config = await obtenerConfiguracion();
  const viaje = await prisma.$transaction(async (tx) => {
    const actual = await cargar(tx, id);
    if (!puedeVer(actor, actual.estado)) throw new NoEncontrado("El viaje no existe.");
    if (!ESTADOS_EDITABLES.includes(actual.estado)) throw new ErrorValidacion("Sólo pueden cerrarse viajes en borrador o abiertos.");
    const datos = { ...datosDe(actual), ...(observaciones ? { observaciones } : {}) };
    const p = await preparar(tx, datos, config);
    const errores = erroresCierre(datos, p, config);
    if (errores.length) throw new ErrorValidacion("No se puede cerrar el viaje.", { errores });
    await actualizarConVersion(tx, id, version, {
      ...datosPersistibles(datos, p),
      estado: "CERRADO",
      closedAt: new Date(),
      closedById: actor.id,
      updatedById: actor.id,
      tarifaSnapshot: snapshotCierre(p, actor),
    });
    const nuevo = await cargar(tx, id);
    await tx.tripAuditLog.create({
      data: {
        tripId: id,
        userId: actor.id,
        accion: "CERRAR",
        estadoAnterior: actual.estado,
        estadoNuevo: "CERRADO",
        cambios: diferencias(auditable(actual), auditable(nuevo)) as Prisma.InputJsonValue,
      },
    });
    return nuevo;
  });
  return { viaje: dtoViaje(viaje, actor) };
}

async function transicion(
  actor: Actor,
  id: string,
  version: number,
  desde: EstadoViaje[],
  hacia: EstadoViaje,
  accion: string,
  extra: Prisma.TripUncheckedUpdateManyInput,
  motivo: string | null,
) {
  const viaje = await prisma.$transaction(async (tx) => {
    const actual = await cargar(tx, id);
    if (!desde.includes(actual.estado)) {
      throw new ErrorValidacion(`No se puede pasar un viaje en estado ${actual.estado.toLowerCase()} a ${hacia.toLowerCase()}.`);
    }
    await actualizarConVersion(tx, id, version, { ...extra, estado: hacia, updatedById: actor.id });
    const nuevo = await cargar(tx, id);
    await tx.tripAuditLog.create({
      data: {
        tripId: id,
        userId: actor.id,
        accion,
        estadoAnterior: actual.estado,
        estadoNuevo: hacia,
        motivo,
        cambios: diferencias(auditable(actual), auditable(nuevo)) as Prisma.InputJsonValue,
      },
    });
    return nuevo;
  });
  return { viaje: dtoViaje(viaje, actor) };
}

export async function facturarViaje(actor: Actor, id: string, input: unknown) {
  exigir(actor, "viajes.facturar");
  const { version, numeroFactura, fechaFactura } = esquemaFacturar.parse(input);
  return transicion(actor, id, version, ["CERRADO"], "FACTURADO", "FACTURAR", {
    numeroFactura,
    fechaFactura: fechaFactura ? fechaADate(fechaFactura) : null,
  }, null);
}

export async function anularViaje(actor: Actor, id: string, input: unknown) {
  exigir(actor, "viajes.anular");
  const { version, motivo } = esquemaMotivo.parse(input);
  return transicion(actor, id, version, ["BORRADOR", "ABIERTO", "CERRADO", "FACTURADO"], "ANULADO", "ANULAR", { motivoAnulacion: motivo }, motivo);
}

export async function reabrirViaje(actor: Actor, id: string, input: unknown) {
  exigir(actor, "viajes.reabrir");
  const { version, motivo } = esquemaMotivo.parse(input);
  return transicion(actor, id, version, ["CERRADO"], "ABIERTO", "REABRIR", { closedAt: null, closedById: null }, motivo);
}

// ---------------------------------------------------------------------------
// Listado y filtros (compartidos con la exportación)
// ---------------------------------------------------------------------------

const siNo = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

export const esquemaFiltros = z.object({
  desde: zFecha.optional().or(z.literal("").transform(() => undefined)),
  hasta: zFecha.optional().or(z.literal("").transform(() => undefined)),
  clientId: z.string().max(64).optional(),
  vehicleId: z.string().max(64).optional(),
  driverId: z.string().max(64).optional(),
  cargoTypeId: z.string().max(64).optional(),
  origenId: z.string().max(64).optional(),
  destinoId: z.string().max(64).optional(),
  estado: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(ESTADOS))),
  modalidad: z.enum(MODALIDADES).optional().or(z.literal("").transform(() => undefined)),
  conDiferencia: siNo,
  pendientesFacturar: siNo,
  sinTarifa: siNo,
  numero: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});
export type FiltrosViaje = z.infer<typeof esquemaFiltros>;

export function construirFiltro(actor: Actor, f: FiltrosViaje): Prisma.TripWhereInput {
  const where: Prisma.TripWhereInput = {};
  const y: Prisma.TripWhereInput[] = [];
  if (f.desde || f.hasta) {
    where.fecha = { ...(f.desde ? { gte: fechaADate(f.desde) } : {}), ...(f.hasta ? { lte: fechaADate(f.hasta) } : {}) };
  }
  if (f.clientId) where.clientId = f.clientId;
  if (f.vehicleId) where.vehicleId = f.vehicleId;
  if (f.driverId) where.driverId = f.driverId;
  if (f.cargoTypeId) where.cargoTypeId = f.cargoTypeId;
  if (f.origenId) where.origenId = f.origenId;
  if (f.destinoId) where.destinoId = f.destinoId;
  if (f.modalidad) where.tarifaModalidad = f.modalidad;
  if (f.conDiferencia) where.alertaDiferencia = true;
  if (f.numero) where.numero = f.numero;
  if (f.estado.length) y.push({ estado: { in: f.estado } });
  if (f.pendientesFacturar) y.push({ estado: "CERRADO" });
  if (f.sinTarifa) y.push({ tariffId: null, estado: { in: ["BORRADOR", "ABIERTO"] } });
  // Restricción de visibilidad por rol (siempre se aplica en el servidor).
  if (!tienePermiso(actor, "viajes.verTodos")) y.push({ estado: { in: ESTADOS_CERRADOS } });
  if (y.length) where.AND = y;
  return where;
}

export async function listarViajes(actor: Actor, params: Record<string, string>) {
  const f = esquemaFiltros.parse(params);
  const where = construirFiltro(actor, f);
  const [items, total, totales] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: incluir,
      orderBy: [{ fecha: "desc" }, { numero: "desc" }],
      skip: (f.pagina - 1) * f.porPagina,
      take: f.porPagina,
    }),
    prisma.trip.count({ where }),
    prisma.trip.groupBy({
      by: ["moneda"],
      where: { AND: [where, { estado: { not: "ANULADO" } }] },
      _sum: { importeFacturado: true, kgBase: true },
      _count: true,
    }),
  ]);
  return {
    items: items.map((v) => dtoViaje(v, actor)),
    total,
    pagina: f.pagina,
    porPagina: f.porPagina,
    totales: totales.map((t) => ({
      moneda: t.moneda,
      viajes: t._count,
      importe: dec(t._sum.importeFacturado) ?? "0",
      kg: dec(t._sum.kgBase) ?? "0",
    })),
  };
}

/** Todos los viajes que cumplen el filtro (para exportar), sin paginar. */
export async function viajesParaExportar(actor: Actor, params: Record<string, string>) {
  exigir(actor, "exportar");
  const f = esquemaFiltros.parse(params);
  const where = construirFiltro(actor, f);
  const items = await prisma.trip.findMany({
    where,
    include: incluir,
    orderBy: [{ fecha: "asc" }, { numero: "asc" }],
    take: 50_000,
  });
  return { filtros: f, items: items.map((v) => dtoViaje(v, actor)) };
}

/** Valores usados recientemente por el usuario, para ordenar las listas del formulario. */
export async function recientes(actor: Actor) {
  const ultimos = await prisma.trip.findMany({
    where: { createdById: actor.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { vehicleId: true, clientId: true, driverId: true, cargoTypeId: true, origenId: true, destinoId: true },
  });
  const unicos = (k: keyof (typeof ultimos)[number]) => [...new Set(ultimos.map((u) => u[k]).filter((x): x is string => !!x))].slice(0, 5);
  return {
    vehicleId: unicos("vehicleId"),
    clientId: unicos("clientId"),
    driverId: unicos("driverId"),
    cargoTypeId: unicos("cargoTypeId"),
    origenId: unicos("origenId"),
    destinoId: unicos("destinoId"),
  };
}
