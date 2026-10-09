"use client";
import { useState } from "react";
import Link from "next/link";
import { descargar, qs, useApi } from "@/lib/cliente/api";
import { useOpciones } from "@/lib/cliente/catalogos";
import { SelectorBuscable } from "@/components/ui/Combobox";
import { CampoTexto, Casilla } from "@/components/ui/Campo";
import { Boton } from "@/components/ui/Boton";
import { Aviso, Cargando, ErrorCarga, Vacio } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { RequierePermiso, usePermiso } from "@/components/Sesion";
import { hoyUruguay } from "@/lib/fechas";
import { formatearImporte, formatearKg, formatearNumero, formatearPct } from "@/lib/formato";
import type { generarInforme } from "@/server/servicios/informes";

type Informe = Awaited<ReturnType<typeof generarInforme>>;

const TIPOS = [
  { valor: "mes", etiqueta: "Comparación mensual" },
  { valor: "cliente", etiqueta: "Por cliente" },
  { valor: "matricula", etiqueta: "Por matrícula" },
  { valor: "chofer", etiqueta: "Por chofer" },
  { valor: "carga", etiqueta: "Por tipo de carga" },
  { valor: "origen", etiqueta: "Por lugar de carga" },
  { valor: "destino", etiqueta: "Por lugar de descarga" },
];

function Contenido() {
  const hoy = hoyUruguay();
  const verTodos = usePermiso("viajes.verTodos");
  const puedeExportar = usePermiso("exportar");
  const [p, setP] = useState({ agrupacion: "cliente", desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, clientId: null as string | null, estimado: false });
  const consulta = qs({ ...p, estimado: p.estimado ? "true" : undefined });
  const { data, error, cargando, recargar } = useApi<Informe>(`/api/informes${consulta}`);
  const clientes = useOpciones("clientes");
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  async function exportar() {
    setExportando(true);
    setErrorExport(null);
    try {
      await descargar(`/api/informes/exportar${consulta}`);
    } catch (e) {
      setErrorExport((e as Error).message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Informes"
        descripcion={data?.verImportes === false ? "Informes operativos (kilos, viajes y diferencias)." : "Facturación, kilos transportados y diferencias de peso."}
        acciones={puedeExportar && <Boton variante="secundario" onClick={exportar} cargando={exportando} disabled={!data?.filas.length}>Exportar a Excel</Boton>}
      />
      {errorExport && <Aviso tipo="error">{errorExport}</Aviso>}
      <div role="tablist" aria-label="Tipo de informe" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            role="tab"
            aria-selected={p.agrupacion === t.valor}
            onClick={() => setP((x) => ({ ...x, agrupacion: t.valor }))}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${p.agrupacion === t.valor ? "bg-marca-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300"}`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>
      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <CampoTexto etiqueta="Desde" type="date" value={p.desde} onChange={(e) => setP((x) => ({ ...x, desde: e.target.value }))} />
          <CampoTexto etiqueta="Hasta" type="date" value={p.hasta} onChange={(e) => setP((x) => ({ ...x, hasta: e.target.value }))} />
          <SelectorBuscable etiqueta="Cliente" opciones={clientes.opciones} valor={p.clientId} onChange={(v) => setP((x) => ({ ...x, clientId: v }))} />
          {verTodos && <Casilla etiqueta="Incluir viajes abiertos (estimado)" checked={p.estimado} onChange={(e) => setP((x) => ({ ...x, estimado: e.target.checked }))} />}
        </div>
        <p className="mt-2 text-xs text-slate-500">Por defecto se consideran viajes cerrados y facturados. Los anulados nunca se incluyen.</p>
      </Tarjeta>

      {cargando && !data && <Cargando />}
      <ErrorCarga error={error} onReintentar={recargar} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {data.totales.map((t) => (
              <div key={t.moneda} className="col-span-2 grid grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase text-slate-500">Viajes ({t.moneda})</p>
                  <p className="text-2xl font-bold tabular">{t.viajes}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs uppercase text-slate-500">Kg transportados</p>
                  <p className="text-2xl font-bold tabular">{formatearKg(t.kgTransportados)}</p>
                </div>
                {data.verImportes && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase text-slate-500">Facturación</p>
                    <p className="text-2xl font-bold tabular">{formatearImporte(t.importe, t.moneda)}</p>
                  </div>
                )}
                <Link href={`/viajes${qs({ conDiferencia: "true", desde: p.desde, hasta: p.hasta, clientId: p.clientId })}`} className="rounded-xl border border-amber-300 bg-white p-4 shadow-sm hover:border-amber-500">
                  <p className="text-xs uppercase text-slate-500">Viajes con diferencia</p>
                  <p className="text-2xl font-bold tabular">{t.viajesConAlerta}</p>
                </Link>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="font-semibold text-marca-700 underline" href={`/viajes${qs({ pendientesFacturar: "true", desde: p.desde, hasta: p.hasta, clientId: p.clientId })}`}>
              Ver viajes pendientes de facturar
            </Link>
            <Link className="font-semibold text-marca-700 underline" href={`/viajes${qs({ conDiferencia: "true", desde: p.desde, hasta: p.hasta, clientId: p.clientId })}`}>
              Ver diferencias de peso
            </Link>
          </div>
          {data.filas.length === 0 ? (
            <Vacio titulo="Sin datos para el período seleccionado" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Informe {data.agrupacionEtiqueta}</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2">{data.agrupacionEtiqueta}</th>
                    <th scope="col" className="px-3 py-2 text-right">Viajes</th>
                    <th scope="col" className="px-3 py-2 text-right">Kg transportados</th>
                    <th scope="col" className="px-3 py-2 text-right">Dif. kg</th>
                    <th scope="col" className="px-3 py-2 text-right">Alertas</th>
                    {data.verImportes && (
                      <>
                        <th scope="col" className="px-3 py-2 text-right">Facturación</th>
                        <th scope="col" className="px-3 py-2 text-right">Prom./viaje</th>
                        <th scope="col" className="px-3 py-2 text-right">Tarifa prom./t</th>
                        {p.agrupacion === "mes" && <th scope="col" className="px-3 py-2 text-right">Var. mes ant.</th>}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.filas.map((f) => (
                    <tr key={`${f.grupo}-${f.moneda}`}>
                      <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium">
                        {f.grupo} {data.totales.length > 1 && <span className="text-xs text-slate-500">({f.moneda})</span>}
                      </th>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular">{f.viajes}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular">{formatearKg(f.kgTransportados)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular">{formatearNumero(f.diferenciaKg)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular">{f.viajesConAlerta}</td>
                      {data.verImportes && (
                        <>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular">{formatearImporte(f.importe, f.moneda)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular">{formatearImporte(f.importePromedioViaje, f.moneda)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular">{formatearImporte(f.tarifaPromedioTonelada, f.moneda)}</td>
                          {p.agrupacion === "mes" && (
                            <td className={`whitespace-nowrap px-3 py-2 text-right tabular ${Number(f.variacionImportePct) < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatearPct(f.variacionImportePct)}</td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PaginaInformes() {
  return (
    <RequierePermiso permiso="informes.operativos">
      <Contenido />
    </RequierePermiso>
  );
}
