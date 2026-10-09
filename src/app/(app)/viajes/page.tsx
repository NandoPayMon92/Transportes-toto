"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { descargar, qs, useApi } from "@/lib/cliente/api";
import { useOpciones } from "@/lib/cliente/catalogos";
import { SelectorBuscable } from "@/components/ui/Combobox";
import { CampoSelector, CampoTexto, Casilla } from "@/components/ui/Campo";
import { Boton } from "@/components/ui/Boton";
import { Aviso, Cargando, ErrorCarga, InsigniaAlerta, InsigniaEstado, Vacio } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { usePermiso } from "@/components/Sesion";
import { formatearFecha } from "@/lib/fechas";
import { formatearImporte, formatearKg, formatearPct } from "@/lib/formato";
import { ESTADOS, ESTADO_ETIQUETA, MODALIDADES, MODALIDAD_ETIQUETA } from "@/lib/domain/tipos";
import type { ViajeDTO } from "@/server/servicios/viajes";

const CLAVES = ["desde", "hasta", "clientId", "vehicleId", "driverId", "cargoTypeId", "origenId", "destinoId", "estado", "modalidad", "conDiferencia", "pendientesFacturar", "sinTarifa", "numero"] as const;
type Filtros = Partial<Record<(typeof CLAVES)[number], string>>;

interface Respuesta {
  items: ViajeDTO[];
  total: number;
  pagina: number;
  porPagina: number;
  totales: Array<{ moneda: string; viajes: number; importe: string; kg: string }>;
}

function Listado() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const puedeExportar = usePermiso("exportar");
  const verTodos = usePermiso("viajes.verTodos");
  const puedeCrear = usePermiso("viajes.crear");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  // Los filtros viven en la URL: la exportación usa exactamente los mismos parámetros.
  const filtros: Filtros = useMemo(() => Object.fromEntries(CLAVES.map((k) => [k, sp.get(k) ?? ""]).filter(([, v]) => v)), [sp]);
  const pagina = Number(sp.get("pagina") ?? "1") || 1;
  const consulta = qs({ ...filtros, pagina, porPagina: 25 });
  const { data, error, cargando, recargar } = useApi<Respuesta>(`/api/viajes${consulta}`);
  const [borrador, setBorrador] = useState<Filtros>(filtros);

  const clientes = useOpciones("clientes");
  const vehiculos = useOpciones("vehiculos");
  const choferes = useOpciones("choferes");
  const cargas = useOpciones("cargas");
  const origenes = useOpciones("lugares", "carga");
  const destinos = useOpciones("lugares", "descarga");

  function aplicar(f: Filtros, pag = 1) {
    router.replace(`${path}${qs({ ...f, pagina: pag > 1 ? pag : undefined })}`);
  }
  const setB = (k: keyof Filtros, v: string | null) => setBorrador((b) => ({ ...b, [k]: v ?? "" }));
  const activos = Object.keys(filtros).length;

  async function exportar() {
    setExportando(true);
    setErrorExport(null);
    try {
      await descargar(`/api/viajes/exportar${qs(filtros)}`);
    } catch (e) {
      setErrorExport((e as Error).message);
    } finally {
      setExportando(false);
    }
  }

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Viajes"
        descripcion={verTodos ? undefined : "Se muestran sólo viajes cerrados y facturados."}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setMostrarFiltros((m) => !m)} aria-expanded={mostrarFiltros} aria-controls="panel-filtros">
              Filtros{activos ? ` (${activos})` : ""}
            </Boton>
            {puedeExportar && (
              <Boton variante="secundario" onClick={exportar} cargando={exportando} disabled={!data?.total}>
                Exportar a Excel
              </Boton>
            )}
            {puedeCrear && (
              <Link href="/viajes/nuevo" className="inline-flex min-h-10 items-center rounded-lg bg-marca-700 px-4 text-sm font-semibold text-white hover:bg-marca-800">
                + Nuevo viaje
              </Link>
            )}
          </>
        }
      />
      {errorExport && <Aviso tipo="error">{errorExport}</Aviso>}

      {mostrarFiltros && (
        <Tarjeta>
          <form
            id="panel-filtros"
            onSubmit={(e) => {
              e.preventDefault();
              aplicar(borrador);
              setMostrarFiltros(false);
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CampoTexto etiqueta="Desde" type="date" value={borrador.desde ?? ""} onChange={(e) => setB("desde", e.target.value)} />
              <CampoTexto etiqueta="Hasta" type="date" value={borrador.hasta ?? ""} onChange={(e) => setB("hasta", e.target.value)} />
              <SelectorBuscable etiqueta="Cliente" opciones={clientes.opciones} valor={borrador.clientId || null} onChange={(v) => setB("clientId", v)} />
              <SelectorBuscable etiqueta="Matrícula" opciones={vehiculos.opciones} valor={borrador.vehicleId || null} onChange={(v) => setB("vehicleId", v)} />
              <SelectorBuscable etiqueta="Chofer" opciones={choferes.opciones} valor={borrador.driverId || null} onChange={(v) => setB("driverId", v)} />
              <SelectorBuscable etiqueta="Tipo de carga" opciones={cargas.opciones} valor={borrador.cargoTypeId || null} onChange={(v) => setB("cargoTypeId", v)} />
              <SelectorBuscable etiqueta="Lugar de carga" opciones={origenes.opciones} valor={borrador.origenId || null} onChange={(v) => setB("origenId", v)} />
              <SelectorBuscable etiqueta="Lugar de descarga" opciones={destinos.opciones} valor={borrador.destinoId || null} onChange={(v) => setB("destinoId", v)} />
              <CampoSelector
                etiqueta="Estado"
                value={borrador.estado ?? ""}
                onChange={(e) => setB("estado", e.target.value)}
                vacio="Todos"
                opciones={ESTADOS.filter((e) => verTodos || e === "CERRADO" || e === "FACTURADO").map((e) => ({ valor: e, etiqueta: ESTADO_ETIQUETA[e] }))}
              />
              <CampoSelector
                etiqueta="Modalidad"
                value={borrador.modalidad ?? ""}
                onChange={(e) => setB("modalidad", e.target.value)}
                vacio="Todas"
                opciones={MODALIDADES.map((m) => ({ valor: m, etiqueta: MODALIDAD_ETIQUETA[m] }))}
              />
              <CampoTexto etiqueta="ID del viaje" inputMode="numeric" value={borrador.numero ?? ""} onChange={(e) => setB("numero", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Casilla etiqueta="Con diferencias de peso" checked={borrador.conDiferencia === "true"} onChange={(e) => setB("conDiferencia", e.target.checked ? "true" : "")} />
              <Casilla etiqueta="Pendientes de facturar" checked={borrador.pendientesFacturar === "true"} onChange={(e) => setB("pendientesFacturar", e.target.checked ? "true" : "")} />
              {verTodos && <Casilla etiqueta="Sin tarifa" checked={borrador.sinTarifa === "true"} onChange={(e) => setB("sinTarifa", e.target.checked ? "true" : "")} />}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Boton type="submit" grande>
                Aplicar filtros
              </Boton>
              <Boton
                variante="secundario"
                grande
                onClick={() => {
                  setBorrador({});
                  aplicar({});
                }}
              >
                Limpiar
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {data && data.totales.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm" aria-label="Totales del filtro">
          <span className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
            <strong>{data.total}</strong> viajes
          </span>
          {data.totales.map((t) => (
            <span key={t.moneda} className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
              {formatearKg(t.kg)} · <strong>{formatearImporte(t.importe, t.moneda)}</strong>
              <span className="text-xs text-slate-500"> (sin anulados)</span>
            </span>
          ))}
        </div>
      )}

      {cargando && !data && <Cargando />}
      <ErrorCarga error={error} onReintentar={recargar} />
      {data && data.items.length === 0 && (
        <Vacio titulo="No hay viajes para mostrar">{activos ? "Pruebe cambiando los filtros." : "Todavía no se registraron viajes."}</Vacio>
      )}

      {data && data.items.length > 0 && (
        <>
          {/* Tarjetas en móvil */}
          <ul className="space-y-2 md:hidden" aria-label="Listado de viajes">
            {data.items.map((v) => (
              <li key={v.id}>
                <Link href={`/viajes/${v.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        #{v.numero} · {v.cliente ?? "Sin cliente"}
                      </p>
                      <p className="text-sm text-slate-600">
                        {formatearFecha(v.fecha)} · {v.matricula ?? "—"} · {v.chofer ?? "—"}
                      </p>
                      <p className="text-sm text-slate-600">
                        {v.origen ?? "—"} → {v.destino ?? "—"}
                      </p>
                    </div>
                    <InsigniaEstado estado={v.estado} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="tabular">{formatearKg(v.kgBase ?? v.kgPromedio ?? v.kgSalida)}</span>
                    <span className="font-bold tabular">{formatearImporte(v.importeFacturado, v.moneda)}</span>
                  </div>
                  {(v.alertaDiferencia || (!v.tarifaModalidad && v.estado !== "ANULADO")) && (
                    <div className="mt-2 flex gap-2">
                      {v.alertaDiferencia && <InsigniaAlerta texto={`Dif. ${formatearPct(v.porcentajeDiferencia)}`} />}
                      {!v.tarifaModalidad && v.estado !== "ANULADO" && <InsigniaAlerta texto="Sin tarifa" />}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Tabla en escritorio */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Viajes</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">ID</th>
                  <th scope="col" className="px-3 py-2">Fecha</th>
                  <th scope="col" className="px-3 py-2">Cliente</th>
                  <th scope="col" className="px-3 py-2">Matrícula</th>
                  <th scope="col" className="px-3 py-2">Chofer</th>
                  <th scope="col" className="px-3 py-2">Recorrido</th>
                  <th scope="col" className="px-3 py-2 text-right">Kg salida</th>
                  <th scope="col" className="px-3 py-2 text-right">Kg llegada</th>
                  <th scope="col" className="px-3 py-2 text-right">Dif. %</th>
                  <th scope="col" className="px-3 py-2 text-right">Importe</th>
                  <th scope="col" className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link href={`/viajes/${v.id}`} className="font-semibold text-marca-700 underline">
                        #{v.numero}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{formatearFecha(v.fecha)}</td>
                    <td className="px-3 py-2">{v.cliente ?? "—"}</td>
                    <td className="px-3 py-2">{v.matricula ?? "—"}</td>
                    <td className="px-3 py-2">{v.chofer ?? "—"}</td>
                    <td className="px-3 py-2">
                      {v.origen ?? "—"} → {v.destino ?? "—"}
                      {v.carga && <span className="block text-xs text-slate-500">{v.carga}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular">{formatearKg(v.kgSalida)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular">{formatearKg(v.kgLlegada)}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right tabular ${v.alertaDiferencia ? "font-bold text-amber-800" : ""}`}>
                      {v.alertaDiferencia && <span aria-label="Alerta de diferencia">⚠ </span>}
                      {formatearPct(v.porcentajeDiferencia)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular">
                      {v.importeFacturado ? formatearImporte(v.importeFacturado, v.moneda) : <span className="text-amber-800">{v.estado === "ANULADO" ? "—" : "Sin tarifa"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <InsigniaEstado estado={v.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="flex items-center justify-between gap-2" aria-label="Paginación">
            <Boton variante="secundario" disabled={pagina <= 1} onClick={() => aplicar(filtros, pagina - 1)}>
              Anterior
            </Boton>
            <span className="text-sm text-slate-600">
              Página {pagina} de {totalPaginas}
            </span>
            <Boton variante="secundario" disabled={pagina >= totalPaginas} onClick={() => aplicar(filtros, pagina + 1)}>
              Siguiente
            </Boton>
          </nav>
        </>
      )}
    </div>
  );
}

export default function PaginaViajes() {
  return (
    <Suspense fallback={<Cargando />}>
      <Listado />
    </Suspense>
  );
}
