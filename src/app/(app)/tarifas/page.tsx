"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api, ErrorApi, qs, useApi } from "@/lib/cliente/api";
import { useOpciones } from "@/lib/cliente/catalogos";
import { SelectorBuscable } from "@/components/ui/Combobox";
import { CampoAreaTexto, CampoTexto, Casilla } from "@/components/ui/Campo";
import { Boton } from "@/components/ui/Boton";
import { Confirmar } from "@/components/ui/Dialogo";
import { Aviso, Cargando, ErrorCarga, Vacio } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { RequierePermiso, usePermiso } from "@/components/Sesion";
import { TextoTarifa, alcance } from "@/components/tarifas/TextoTarifa";
import { formatearFecha, hoyUruguay } from "@/lib/fechas";
import type { TarifaDTO } from "@/server/servicios/tarifas";

interface Diagnostico {
  conflictos: Array<{ a: TarifaDTO; b: TarifaDTO }>;
  clientesSinTarifa: Array<{ id: string; nombre: string }>;
}

function vigente(t: TarifaDTO, hoy: string) {
  return t.activo && t.vigenciaDesde <= hoy && (!t.vigenciaHasta || t.vigenciaHasta >= hoy);
}

function Contenido() {
  const gestionar = usePermiso("tarifas.gestionar");
  const [clientId, setClientId] = useState<string | null>(null);
  const [inactivas, setInactivas] = useState(false);
  const [soloVigentes, setSoloVigentes] = useState(false);
  const { data, error, cargando, recargar } = useApi<TarifaDTO[]>(`/api/tarifas${qs({ clientId, inactivas, vigentes: soloVigentes })}`);
  const diag = useApi<Diagnostico>("/api/tarifas/diagnostico");
  const clientes = useOpciones("clientes");
  const hoy = hoyUruguay();

  const [aumento, setAumento] = useState(false);
  const [datosAumento, setDatosAumento] = useState({ clientId: null as string | null, porcentaje: "", vigenciaDesde: hoy, motivo: "" });
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const grupos = useMemo(() => {
    const m = new Map<string, TarifaDTO[]>();
    for (const t of data ?? []) m.set(t.cliente, [...(m.get(t.cliente) ?? []), t]);
    return [...m.entries()];
  }, [data]);

  async function aplicarAumento() {
    setEnviando(true);
    try {
      const r = await api<TarifaDTO[]>("/api/tarifas/aumento", { body: { ...datosAumento, porcentaje: datosAumento.porcentaje.replace(",", ".") } });
      setMensaje({ tipo: "exito", texto: `Se crearon ${r.length} nuevas vigencias.` });
      setAumento(false);
      await recargar();
    } catch (e) {
      setMensaje({ tipo: "error", texto: (e as ErrorApi).message });
      setAumento(false);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Encabezado
        titulo="Tarifario"
        descripcion="Tarifas por cliente con historial de vigencias. Los viajes cerrados conservan la tarifa con la que se cerraron."
        acciones={
          <>
            <Link href="/tarifas/simulador" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-marca-700 hover:bg-slate-50">
              ¿Qué tarifa aplica?
            </Link>
            {gestionar && (
              <>
                <Link href="/tarifas/importar" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-marca-700 hover:bg-slate-50">
                  Cargar desde Excel
                </Link>
                <Boton variante="secundario" onClick={() => setAumento(true)}>
                  Aumento por %
                </Boton>
                <Link href={`/tarifas/nueva${qs({ clientId })}`} className="inline-flex min-h-10 items-center rounded-lg bg-marca-700 px-4 text-sm font-semibold text-white hover:bg-marca-800">
                  + Nueva tarifa
                </Link>
              </>
            )}
          </>
        }
      />
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      {diag.data && diag.data.conflictos.length > 0 && (
        <Aviso tipo="error" titulo="Error de configuración: tarifas con vigencias superpuestas">
          <ul className="list-disc pl-5">
            {diag.data.conflictos.map((c, i) => (
              <li key={i}>
                {c.a.cliente} · {alcance(c.a)}:{" "}
                <Link className="underline" href={`/tarifas/${c.a.id}`}>
                  desde {formatearFecha(c.a.vigenciaDesde)}
                </Link>{" "}
                y{" "}
                <Link className="underline" href={`/tarifas/${c.b.id}`}>
                  desde {formatearFecha(c.b.vigenciaDesde)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1">Mientras no se corrija, los viajes afectados no podrán cerrarse.</p>
        </Aviso>
      )}
      {diag.data && diag.data.clientesSinTarifa.length > 0 && (
        <Aviso tipo="advertencia" titulo="Clientes con tarifas pendientes de configuración">
          <ul className="mt-1 flex flex-wrap gap-2">
            {diag.data.clientesSinTarifa.map((c) => (
              <li key={c.id}>
                {gestionar ? (
                  <Link href={`/tarifas/nueva?clientId=${c.id}`} className="inline-block rounded-full bg-white px-3 py-1 font-medium underline ring-1 ring-amber-400">
                    {c.nombre} — cargar tarifa
                  </Link>
                ) : (
                  <span className="inline-block rounded-full bg-white px-3 py-1 ring-1 ring-amber-400">{c.nombre}</span>
                )}
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <SelectorBuscable etiqueta="Buscar por cliente" opciones={clientes.opciones} valor={clientId} onChange={setClientId} />
          <Casilla etiqueta="Sólo vigentes hoy" checked={soloVigentes} onChange={(e) => setSoloVigentes(e.target.checked)} />
          <Casilla etiqueta="Incluir inactivas" checked={inactivas} onChange={(e) => setInactivas(e.target.checked)} />
        </div>
      </Tarjeta>

      {cargando && !data && <Cargando />}
      <ErrorCarga error={error} onReintentar={recargar} />
      {data && data.length === 0 && <Vacio titulo="No hay tarifas cargadas">{gestionar && "Use «Nueva tarifa» o «Cargar desde Excel»."}</Vacio>}
      {grupos.map(([cliente, tarifas]) => (
        <Tarjeta key={cliente} titulo={cliente}>
          <ul className="divide-y divide-slate-100">
            {tarifas.map((t) => (
              <li key={t.id}>
                <Link href={`/tarifas/${t.id}`} className="flex flex-col gap-1 py-2.5 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="block text-sm font-medium">{alcance(t)}</span>
                    <span className="text-sm">
                      <TextoTarifa t={t} />
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-600">
                    {formatearFecha(t.vigenciaDesde)} → {t.vigenciaHasta ? formatearFecha(t.vigenciaHasta) : "sin fin"}
                    {!t.activo ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">Inactiva</span>
                    ) : vigente(t, hoy) ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">Vigente</span>
                    ) : t.vigenciaDesde > hoy ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-900">Futura</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">Histórica</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ))}

      <Confirmar
        abierto={aumento}
        titulo="Aumento porcentual de tarifas"
        mensaje="Crea una nueva vigencia para cada tarifa activa del cliente vigente en la fecha indicada. Las tarifas anteriores se cierran el día previo."
        textoConfirmar="Aplicar aumento"
        cargando={enviando}
        deshabilitado={!datosAumento.clientId || !datosAumento.porcentaje || datosAumento.motivo.trim().length < 3}
        onCancelar={() => setAumento(false)}
        onConfirmar={aplicarAumento}
      >
        <SelectorBuscable etiqueta="Cliente" opciones={clientes.opciones} valor={datosAumento.clientId} onChange={(v) => setDatosAumento((d) => ({ ...d, clientId: v }))} obligatorio />
        <CampoTexto etiqueta="Porcentaje" inputMode="decimal" value={datosAumento.porcentaje} onChange={(e) => setDatosAumento((d) => ({ ...d, porcentaje: e.target.value }))} ayuda="Ej.: 4 para +4 %; -2 para una rebaja." obligatorio />
        <CampoTexto etiqueta="Vigente desde" type="date" value={datosAumento.vigenciaDesde} onChange={(e) => setDatosAumento((d) => ({ ...d, vigenciaDesde: e.target.value }))} obligatorio />
        <CampoAreaTexto etiqueta="Motivo" value={datosAumento.motivo} onChange={(e) => setDatosAumento((d) => ({ ...d, motivo: e.target.value }))} obligatorio />
      </Confirmar>
    </div>
  );
}

export default function PaginaTarifas() {
  return (
    <RequierePermiso permiso="tarifas.ver">
      <Contenido />
    </RequierePermiso>
  );
}
