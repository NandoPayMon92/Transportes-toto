import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { tienePermiso, type Actor } from "@/lib/permisos";
import { esFechaISO, fechaADate, hoyUruguay, primerDiaMes, ultimoDiaMes } from "@/lib/fechas";
import { dec, fecha } from "./util";
import { diagnosticoTarifario } from "./tarifas";

export async function panel(actor: Actor, params: { desde?: string; hasta?: string }) {
  const hoy = hoyUruguay();
  const desde = params.desde && esFechaISO(params.desde) ? params.desde : primerDiaMes(hoy);
  const hasta = params.hasta && esFechaISO(params.hasta) ? params.hasta : ultimoDiaMes(hoy);
  const verTodos = tienePermiso(actor, "viajes.verTodos");
  const verImportes = tienePermiso(actor, "informes.facturacion") || tienePermiso(actor, "viajes.crear");
  const visibles = verTodos ? undefined : { in: ["CERRADO", "FACTURADO"] as ("CERRADO" | "FACTURADO")[] };
  const periodo = { fecha: { gte: fechaADate(desde), lte: fechaADate(hasta) } };

  const [delDia, abiertos, pendientesFacturar, agregados, alertas, incompletos] = await Promise.all([
    prisma.trip.count({ where: { fecha: fechaADate(hoy), estado: visibles ?? { not: "ANULADO" } } }),
    verTodos ? prisma.trip.count({ where: { estado: { in: ["BORRADOR", "ABIERTO"] } } }) : Promise.resolve(0),
    prisma.trip.count({ where: { estado: "CERRADO" } }),
    prisma.trip.groupBy({
      by: ["moneda"],
      where: { ...periodo, estado: visibles ?? { not: "ANULADO" } },
      _sum: { importeFacturado: true, kgBase: true, kgPromedio: true },
      _count: true,
    }),
    prisma.trip.findMany({
      where: { ...periodo, alertaDiferencia: true, estado: visibles ?? { not: "ANULADO" } },
      orderBy: [{ fecha: "desc" }],
      take: 10,
      include: { client: { select: { nombre: true } }, vehicle: { select: { matricula: true } } },
    }),
    verTodos
      ? prisma.trip.findMany({
          where: {
            estado: { in: ["BORRADOR", "ABIERTO"] },
            OR: [{ tariffId: null }, { estado: "BORRADOR" }, { importeFacturado: null }],
          },
          orderBy: [{ fecha: "desc" }],
          take: 10,
          include: { client: { select: { nombre: true } }, vehicle: { select: { matricula: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Kilos transportados: base de facturación si existe, si no el promedio.
  const kgPeriodo = await prisma.$queryRaw<{ kg: unknown }[]>`
    SELECT COALESCE(SUM(COALESCE("kgBase", "kgPromedio", "kgSalida", "kgLlegada")), 0) AS kg
    FROM "Trip"
    WHERE "fecha" BETWEEN ${fechaADate(desde)} AND ${fechaADate(hasta)}
      AND "estado"::text IN (${Prisma.join(verTodos ? ["BORRADOR", "ABIERTO", "CERRADO", "FACTURADO"] : ["CERRADO", "FACTURADO"])})`;

  const resumen = (v: (typeof alertas)[number]) => ({
    id: v.id,
    numero: v.numero,
    fecha: fecha(v.fecha),
    cliente: v.client?.nombre ?? null,
    matricula: v.vehicle?.matricula ?? null,
    estado: v.estado,
    porcentajeDiferencia: dec(v.porcentajeDiferencia),
    tieneTarifa: !!v.tariffId,
  });

  const diag = tienePermiso(actor, "tarifas.gestionar") ? await diagnosticoTarifario(actor) : null;

  return {
    periodo: { desde, hasta },
    viajesDelDia: delDia,
    viajesAbiertos: abiertos,
    pendientesFacturar,
    kgPeriodo: String(kgPeriodo[0]?.kg ?? "0"),
    facturacion: verImportes
      ? agregados.map((a) => ({ moneda: a.moneda, viajes: a._count, importe: dec(a._sum.importeFacturado) ?? "0" }))
      : [],
    alertasDiferencia: alertas.map(resumen),
    incompletos: incompletos.map(resumen),
    tarifario: diag,
  };
}
