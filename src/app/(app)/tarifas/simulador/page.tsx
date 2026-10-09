"use client";
import { useState } from "react";
import Link from "next/link";
import { qs, useApi } from "@/lib/cliente/api";
import { useOpciones } from "@/lib/cliente/catalogos";
import { SelectorBuscable } from "@/components/ui/Combobox";
import { CampoTexto } from "@/components/ui/Campo";
import { Aviso, Cargando } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { RequierePermiso } from "@/components/Sesion";
import { TextoTarifa, alcance } from "@/components/tarifas/TextoTarifa";
import { formatearFecha, hoyUruguay } from "@/lib/fechas";
import type { ResultadoResolucion } from "@/server/servicios/tarifas";

function Contenido() {
  const [c, setC] = useState({ clientId: null as string | null, fecha: hoyUruguay(), origenId: null as string | null, destinoId: null as string | null, cargoTypeId: null as string | null });
  const clientes = useOpciones("clientes");
  const origenes = useOpciones("lugares", "carga");
  const destinos = useOpciones("lugares", "descarga");
  const cargas = useOpciones("cargas");
  const { data, cargando, error } = useApi<ResultadoResolucion>(c.clientId && c.fecha ? `/api/tarifas/simular${qs(c)}` : null);

  return (
    <div className="space-y-4">
      <Encabezado titulo="¿Qué tarifa se aplicaría?" descripcion="Indique una combinación para ver qué tarifa elegiría el sistema y por qué." />
      <Tarjeta>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectorBuscable etiqueta="Cliente" opciones={clientes.opciones} valor={c.clientId} onChange={(v) => setC((x) => ({ ...x, clientId: v }))} obligatorio />
          <CampoTexto etiqueta="Fecha del viaje" type="date" value={c.fecha} onChange={(e) => setC((x) => ({ ...x, fecha: e.target.value }))} />
          <SelectorBuscable etiqueta="Lugar de carga" opciones={origenes.opciones} valor={c.origenId} onChange={(v) => setC((x) => ({ ...x, origenId: v }))} />
          <SelectorBuscable etiqueta="Lugar de descarga" opciones={destinos.opciones} valor={c.destinoId} onChange={(v) => setC((x) => ({ ...x, destinoId: v }))} />
          <SelectorBuscable etiqueta="Tipo de carga" opciones={cargas.opciones} valor={c.cargoTypeId} onChange={(v) => setC((x) => ({ ...x, cargoTypeId: v }))} />
        </div>
      </Tarjeta>
      {cargando && <Cargando texto="Buscando tarifa…" />}
      {error && <Aviso tipo="error">{error.message}</Aviso>}
      {data?.tipo === "OK" && (
        <Aviso tipo="exito" titulo={`Se aplicaría la tarifa de prioridad ${data.nivel}: ${data.nivelEtiqueta}`}>
          <p>
            <TextoTarifa t={data.tarifa} /> · {alcance(data.tarifa)} · vigente desde {formatearFecha(data.tarifa.vigenciaDesde)}
          </p>
          <Link href={`/tarifas/${data.tarifa.id}`} className="font-semibold underline">Ver tarifa</Link>
        </Aviso>
      )}
      {data?.tipo === "SIN_TARIFA" && <Aviso tipo="advertencia">{data.mensaje}</Aviso>}
      {data?.tipo === "CONFLICTO" && (
        <Aviso tipo="error" titulo={data.mensaje}>
          <ul className="list-disc pl-5">
            {data.tarifas.map((t) => (
              <li key={t.id}>
                <Link href={`/tarifas/${t.id}`} className="underline">{alcance(t)} desde {formatearFecha(t.vigenciaDesde)}</Link>
              </li>
            ))}
          </ul>
        </Aviso>
      )}
    </div>
  );
}

export default function PaginaSimulador() {
  return (
    <RequierePermiso permiso="tarifas.ver">
      <Contenido />
    </RequierePermiso>
  );
}
