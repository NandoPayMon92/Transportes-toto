import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { exigir } from "./autorizacion";
import { tienePermiso, type Actor } from "@/lib/permisos";
import { ESTADOS } from "@/lib/domain/tipos";
import { fechaADate, hoyUruguay, primerDiaMes } from "@/lib/fechas";
import { z, zFecha } from "@/lib/validacion";
import * as D from "@/lib/domain/decimal";

export const AGRUPACIONES = {
  mes: { etiqueta: "Mes", sql: Prisma.sql`to_char(t."fecha", 'YYYY-MM')`, orden: "grupo" },
  cliente: { etiqueta: "Cliente", sql: Prisma.sql`COALESCE(c."nombre", 'Sin cliente')`, orden: "importe" },
  matricula: { etiqueta: "Matrícula", sql: Prisma.sql`COALESCE(v."matricula", 'Sin matrícula')`, orden: "importe" },
  chofer: { etiqueta: "Chofer", sql: Prisma.sql`COALESCE(d."nombre", 'Sin chofer')`, orden: "importe" },
  carga: { etiqueta: "Tipo de carga", sql: Prisma.sql`COALESCE(k."nombre", 'Sin tipo')`, orden: "importe" },
  origen: { etiqueta: "Lugar de carga", sql: Prisma.sql`COALESCE(o."nombre", 'Sin lugar')`, orden: "importe" },
  destino: { etiqueta: "Lugar de descarga", sql: Prisma.sql`COALESCE(de."nombre", 'Sin lugar')`, orden: "importe" },
} as const;
export type Agrupacion = keyof typeof AGRUPACIONES;

export const esquemaInforme = z.object({
  agrupacion: z.enum(Object.keys(AGRUPACIONES) as [Agrupacion, ...Agrupacion[]]).default("cliente"),
  desde: zFecha.optional().or(z.literal("").transform(() => undefined)),
  hasta: zFecha.optional().or(z.literal("").transform(() => undefined)),
  clientId: z.string().max(64).optional().or(z.literal("").transform(() => undefined)),
  /** Por defecto sólo cerrados y facturados (facturación real); con "estimado" incluye borradores y abiertos. */
  estimado: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v === "true"),
});
export type ParametrosInforme = z.infer<typeof esquemaInforme>;

interface FilaSql {
  grupo: string;
  moneda: string;
  viajes: number;
  kg_salida: Prisma.Decimal | null;
  kg_llegada: Prisma.Decimal | null;
  kg: Prisma.Decimal | null;
  dif: Prisma.Decimal | null;
  alertas: number;
  importe: Prisma.Decimal | null;
  importe_peso: Prisma.Decimal | null;
  kg_peso: Prisma.Decimal | null;
}

const s = (v: Prisma.Decimal | null | undefined) => (v ? v.toString() : "0");

function cociente(a: string, b: string, decimales: number): string | null {
  const den = D.parseFixed(b);
  if (D.isZero(den)) return null;
  return D.toFixedString(D.div(D.parseFixed(a), den, decimales), decimales);
}

export async function generarInforme(actor: Actor, params: Record<string, string>) {
  exigir(actor, "informes.operativos");
  const p = esquemaInforme.parse(params);
  const verImportes = tienePermiso(actor, "informes.facturacion");
  const hoy = hoyUruguay();
  const desde = p.desde ?? primerDiaMes(hoy).slice(0, 5) + "01-01";
  const hasta = p.hasta ?? hoy;
  const estados =
    p.estimado && tienePermiso(actor, "viajes.verTodos")
      ? ESTADOS.filter((e) => e !== "ANULADO")
      : (["CERRADO", "FACTURADO"] as const);

  const grupo = AGRUPACIONES[p.agrupacion];
  const condiciones = [
    Prisma.sql`t."fecha" >= ${fechaADate(desde)}`,
    Prisma.sql`t."fecha" <= ${fechaADate(hasta)}`,
    Prisma.sql`t."estado"::text IN (${Prisma.join([...estados])})`,
  ];
  if (p.clientId) condiciones.push(Prisma.sql`t."clientId" = ${p.clientId}`);

  const filas = await prisma.$queryRaw<FilaSql[]>`
    SELECT ${grupo.sql} AS grupo,
           t."moneda" AS moneda,
           COUNT(*)::int AS viajes,
           SUM(t."kgSalida") AS kg_salida,
           SUM(t."kgLlegada") AS kg_llegada,
           SUM(COALESCE(t."kgBase", t."kgPromedio", t."kgSalida", t."kgLlegada")) AS kg,
           SUM(t."kgDiferencia") AS dif,
           SUM(CASE WHEN t."alertaDiferencia" THEN 1 ELSE 0 END)::int AS alertas,
           SUM(t."importeFacturado") AS importe,
           SUM(CASE WHEN t."tarifaModalidad" = 'POR_PESO' THEN t."importeFacturado" END) AS importe_peso,
           SUM(CASE WHEN t."tarifaModalidad" = 'POR_PESO' THEN t."kgBase" END) AS kg_peso
    FROM "Trip" t
    LEFT JOIN "Client" c ON c."id" = t."clientId"
    LEFT JOIN "Vehicle" v ON v."id" = t."vehicleId"
    LEFT JOIN "Driver" d ON d."id" = t."driverId"
    LEFT JOIN "CargoType" k ON k."id" = t."cargoTypeId"
    LEFT JOIN "Location" o ON o."id" = t."origenId"
    LEFT JOIN "Location" de ON de."id" = t."destinoId"
    WHERE ${Prisma.join(condiciones, " AND ")}
    GROUP BY 1, 2
    ORDER BY 1 ASC, 2 ASC`;

  let filasOut = filas.map((f) => {
    const kg = s(f.kg);
    const importe = s(f.importe);
    return {
      grupo: f.grupo,
      moneda: f.moneda,
      viajes: f.viajes,
      kgSalida: s(f.kg_salida),
      kgLlegada: s(f.kg_llegada),
      kgTransportados: kg,
      toneladas: D.toFixedString(D.div(D.parseFixed(kg), D.parseFixed("1000"), 3), 3),
      diferenciaKg: s(f.dif),
      viajesConAlerta: f.alertas,
      importe: verImportes ? importe : null,
      importePromedioViaje: verImportes ? cociente(importe, String(f.viajes), 2) : null,
      tarifaPromedioTonelada: verImportes && f.kg_peso ? cociente(D.toFixedString(D.mul(D.parseFixed(s(f.importe_peso)), D.parseFixed("1000")), 4), s(f.kg_peso), 2) : null,
      variacionImportePct: null as string | null,
    };
  });

  if (p.agrupacion === "mes" && verImportes) {
    // Comparación mensual: variación del importe respecto del mes anterior (misma moneda).
    const anterior = new Map<string, string>();
    filasOut = filasOut.map((f) => {
      const prev = anterior.get(f.moneda);
      anterior.set(f.moneda, f.importe ?? "0");
      if (prev === undefined || D.isZero(D.parseFixed(prev))) return f;
      const delta = D.sub(D.parseFixed(f.importe ?? "0"), D.parseFixed(prev));
      return { ...f, variacionImportePct: D.toFixedString(D.div(D.mul(delta, D.parseFixed("100")), D.parseFixed(prev), 2), 2) };
    });
  } else if (grupo.orden === "importe") {
    filasOut.sort((a, b) => Number(b.importe ?? b.kgTransportados) - Number(a.importe ?? a.kgTransportados));
  }

  // Totales por moneda
  const totales = new Map<string, { moneda: string; viajes: number; kg: D.Fixed; importe: D.Fixed; alertas: number }>();
  for (const f of filasOut) {
    const t = totales.get(f.moneda) ?? { moneda: f.moneda, viajes: 0, kg: D.parseFixed("0"), importe: D.parseFixed("0"), alertas: 0 };
    t.viajes += f.viajes;
    t.alertas += f.viajesConAlerta;
    t.kg = D.add(t.kg, D.parseFixed(f.kgTransportados));
    t.importe = D.add(t.importe, D.parseFixed(f.importe ?? "0"));
    totales.set(f.moneda, t);
  }

  return {
    parametros: { ...p, desde, hasta, estados },
    agrupacionEtiqueta: grupo.etiqueta,
    verImportes,
    filas: filasOut,
    totales: [...totales.values()].map((t) => ({
      moneda: t.moneda,
      viajes: t.viajes,
      viajesConAlerta: t.alertas,
      kgTransportados: D.toFixedString(t.kg, 2),
      importe: verImportes ? D.toFixedString(t.importe, 2) : null,
    })),
  };
}
