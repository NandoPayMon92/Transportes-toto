"use client";
import { useState } from "react";
import Link from "next/link";
import { qs, useApi } from "@/lib/cliente/api";
import { Cargando, ErrorCarga, InsigniaEstado, Aviso } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { CampoTexto } from "@/components/ui/Campo";
import { usePermiso, useSesion } from "@/components/Sesion";
import { formatearFecha, hoyUruguay } from "@/lib/fechas";
import { formatearImporte, formatearKg, formatearPct } from "@/lib/formato";
import type { Estado } from "@/lib/domain/tipos";

interface Resumen {
  id: string;
  numero: number;
  fecha: string;
  cliente: string | null;
  matricula: string | null;
  estado: Estado;
  porcentajeDiferencia: string | null;
  tieneTarifa: boolean;
}

interface Panel {
  periodo: { desde: string; hasta: string };
  viajesDelDia: number;
  viajesAbiertos: number;
  pendientesFacturar: number;
  kgPeriodo: string;
  facturacion: Array<{ moneda: string; viajes: number; importe: string }>;
  alertasDiferencia: Resumen[];
  incompletos: Resumen[];
  tarifario: null | { conflictos: Array<{ a: { id: string; cliente: string }; b: { id: string } }>; clientesSinTarifa: Array<{ id: string; nombre: string }> };
}

function Indicador({ titulo, valor, href, tono = "normal" }: { titulo: string; valor: React.ReactNode; href?: string; tono?: "normal" | "alerta" }) {
  const contenido = (
    <div className={`h-full rounded-xl border bg-white p-4 shadow-sm ${tono === "alerta" ? "border-amber-400" : "border-slate-200"} ${href ? "hover:border-marca-600" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular">{valor}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{contenido}</Link> : contenido;
}

function ListaViajes({ items, vacio, mostrarDif }: { items: Resumen[]; vacio: string; mostrarDif?: boolean }) {
  if (!items.length) return <p className="text-sm text-slate-600">{vacio}</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((v) => (
        <li key={v.id}>
          <Link href={`/viajes/${v.id}`} className="flex items-center justify-between gap-2 py-2 hover:bg-slate-50">
            <span className="text-sm">
              <strong>#{v.numero}</strong> · {formatearFecha(v.fecha)} · {v.cliente ?? "Sin cliente"} · {v.matricula ?? "—"}
              {mostrarDif && <span className="ml-1 font-semibold text-amber-800">({formatearPct(v.porcentajeDiferencia)})</span>}
              {!mostrarDif && !v.tieneTarifa && <span className="ml-1 text-amber-800">· sin tarifa</span>}
            </span>
            <InsigniaEstado estado={v.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PaginaPanel() {
  const actor = useSesion();
  const verTodos = usePermiso("viajes.verTodos");
  const puedeCrear = usePermiso("viajes.crear");
  const [periodo, setPeriodo] = useState<{ desde?: string; hasta?: string }>({});
  const { data, error, cargando, recargar } = useApi<Panel>(`/api/panel${qs(periodo)}`);

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={`Hola, ${actor.nombre.split(" ")[0]}`}
        descripcion={data ? `Período: ${formatearFecha(data.periodo.desde)} al ${formatearFecha(data.periodo.hasta)}` : undefined}
        acciones={
          puedeCrear && (
            <Link href="/viajes/nuevo" className="inline-flex min-h-12 items-center rounded-lg bg-marca-700 px-5 font-semibold text-white hover:bg-marca-800">
              + Nuevo viaje
            </Link>
          )
        }
      />
      <details className="rounded-xl border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium text-marca-700">Cambiar período</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <CampoTexto etiqueta="Desde" type="date" value={periodo.desde ?? data?.periodo.desde ?? ""} onChange={(e) => setPeriodo((p) => ({ ...p, desde: e.target.value }))} />
          <CampoTexto etiqueta="Hasta" type="date" value={periodo.hasta ?? data?.periodo.hasta ?? ""} onChange={(e) => setPeriodo((p) => ({ ...p, hasta: e.target.value }))} />
        </div>
      </details>

      {cargando && !data && <Cargando />}
      <ErrorCarga error={error} onReintentar={recargar} />
      {data && (
        <>
          {data.tarifario && (data.tarifario.conflictos.length > 0 || data.tarifario.clientesSinTarifa.length > 0) && (
            <Aviso tipo={data.tarifario.conflictos.length ? "error" : "advertencia"} titulo="Revisar tarifario">
              {data.tarifario.conflictos.length > 0 && <p>Hay {data.tarifario.conflictos.length} conflicto(s) de vigencias superpuestas.</p>}
              {data.tarifario.clientesSinTarifa.length > 0 && (
                <p>Clientes sin tarifa vigente (pendientes de configuración): {data.tarifario.clientesSinTarifa.map((c) => c.nombre).join(", ")}.</p>
              )}
              <Link href="/tarifas" className="mt-1 inline-block font-semibold underline">
                Ir al tarifario
              </Link>
            </Aviso>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador titulo="Viajes del día" valor={data.viajesDelDia} href={`/viajes${qs({ desde: hoyUruguay(), hasta: hoyUruguay() })}`} />
            {verTodos && <Indicador titulo="Viajes abiertos" valor={data.viajesAbiertos} href="/viajes?estado=BORRADOR,ABIERTO" />}
            <Indicador titulo="Pendientes de facturar" valor={data.pendientesFacturar} href="/viajes?pendientesFacturar=true" />
            <Indicador titulo="Kg transportados" valor={formatearKg(data.kgPeriodo)} />
            {data.facturacion.map((f) => (
              <Indicador key={f.moneda} titulo={`Facturación estimada (${f.moneda})`} valor={formatearImporte(f.importe, f.moneda)} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Alertas por diferencia de peso" acciones={<Link href="/viajes?conDiferencia=true" className="text-sm font-semibold text-marca-700 underline">Ver todas</Link>}>
              <ListaViajes items={data.alertasDiferencia} vacio="Sin alertas en el período." mostrarDif />
            </Tarjeta>
            {verTodos && (
              <Tarjeta titulo="Sin tarifa o con datos incompletos" acciones={<Link href="/viajes?sinTarifa=true" className="text-sm font-semibold text-marca-700 underline">Ver sin tarifa</Link>}>
                <ListaViajes items={data.incompletos} vacio="No hay viajes pendientes de completar." />
              </Tarjeta>
            )}
          </div>
        </>
      )}
    </div>
  );
}
