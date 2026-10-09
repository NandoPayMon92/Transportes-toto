"use client";
import { useState } from "react";
import { SelectorBuscable } from "@/components/ui/Combobox";
import { CampoAreaTexto, CampoSelector, CampoTexto, Casilla } from "@/components/ui/Campo";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Estados";
import { useOpciones } from "@/lib/cliente/catalogos";
import { hoyUruguay } from "@/lib/fechas";
import { BASES, BASE_ETIQUETA, MODALIDAD_ETIQUETA, MONEDAS, MONEDA_ETIQUETA, UNIDADES, UNIDAD_ETIQUETA } from "@/lib/domain/tipos";
import { NIVEL_ETIQUETA, nivelTarifa } from "@/lib/domain/tarifas";
import type { TarifaDTO } from "@/server/servicios/tarifas";

export interface DatosTarifa {
  clientId: string | null;
  modalidad: "FIJO" | "POR_PESO";
  importe: string;
  moneda: string;
  unidad: string;
  baseCalculo: string;
  origenId: string | null;
  destinoId: string | null;
  cargoTypeId: string | null;
  vigenciaDesde: string;
  vigenciaHasta: string;
  activo: boolean;
  observaciones: string;
}

export function datosDesde(t?: TarifaDTO, clientId?: string | null, base = "PROMEDIO"): DatosTarifa {
  return {
    clientId: t?.clientId ?? clientId ?? null,
    modalidad: t?.modalidad ?? "POR_PESO",
    importe: t?.importe ?? "",
    moneda: t?.moneda ?? "UYU",
    unidad: t?.unidad ?? "TONELADA",
    baseCalculo: t?.baseCalculo ?? base,
    origenId: t?.origenId ?? null,
    destinoId: t?.destinoId ?? null,
    cargoTypeId: t?.cargoTypeId ?? null,
    vigenciaDesde: t?.vigenciaDesde ?? hoyUruguay(),
    vigenciaHasta: t?.vigenciaHasta ?? "",
    activo: t?.activo ?? true,
    observaciones: t?.observaciones ?? "",
  };
}

interface Props {
  inicial: DatosTarifa;
  edicion?: boolean;
  enviando: boolean;
  error: { mensaje: string; lista: string[] } | null;
  onEnviar: (d: DatosTarifa, motivo: string) => void;
}

export function FormularioTarifa({ inicial, edicion, enviando, error, onEnviar }: Props) {
  const [d, setD] = useState<DatosTarifa>(inicial);
  const [motivo, setMotivo] = useState("");
  const clientes = useOpciones("clientes");
  const origenes = useOpciones("lugares", "carga");
  const destinos = useOpciones("lugares", "descarga");
  const cargas = useOpciones("cargas");
  const set = <K extends keyof DatosTarifa>(k: K, v: DatosTarifa[K]) => setD((x) => ({ ...x, [k]: v }));
  const nivel = nivelTarifa(d);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar(d, motivo);
      }}
      className="space-y-4"
      noValidate
    >
      {error && <Aviso tipo="error" titulo={error.mensaje} lista={error.lista} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorBuscable etiqueta="Cliente" opciones={clientes.opciones} valor={d.clientId} onChange={(v) => set("clientId", v)} obligatorio deshabilitado={edicion} />
        <CampoSelector
          etiqueta="Modalidad"
          value={d.modalidad}
          onChange={(e) => set("modalidad", e.target.value as DatosTarifa["modalidad"])}
          opciones={[
            { valor: "POR_PESO", etiqueta: MODALIDAD_ETIQUETA.POR_PESO },
            { valor: "FIJO", etiqueta: MODALIDAD_ETIQUETA.FIJO },
          ]}
          obligatorio
        />
        <CampoTexto
          etiqueta={d.modalidad === "FIJO" ? "Importe por viaje" : `Tarifa ${d.unidad === "KG" ? "por kg" : "por tonelada"}`}
          inputMode="decimal"
          value={d.importe}
          onChange={(e) => set("importe", e.target.value)}
          obligatorio
          ayuda="Hasta 4 decimales. Admite coma decimal."
        />
        <CampoSelector etiqueta="Moneda" value={d.moneda} onChange={(e) => set("moneda", e.target.value)} opciones={MONEDAS.map((m) => ({ valor: m, etiqueta: MONEDA_ETIQUETA[m] }))} />
        {d.modalidad === "POR_PESO" && (
          <>
            <CampoSelector etiqueta="Unidad" value={d.unidad} onChange={(e) => set("unidad", e.target.value)} opciones={UNIDADES.map((u) => ({ valor: u, etiqueta: UNIDAD_ETIQUETA[u] }))} obligatorio />
            <CampoSelector etiqueta="Base de cálculo" value={d.baseCalculo} onChange={(e) => set("baseCalculo", e.target.value)} opciones={BASES.map((b) => ({ valor: b, etiqueta: BASE_ETIQUETA[b] }))} obligatorio />
          </>
        )}
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-700">Alcance (opcional)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectorBuscable etiqueta="Lugar de carga" opciones={origenes.opciones} valor={d.origenId} onChange={(v) => set("origenId", v)} />
          <SelectorBuscable etiqueta="Lugar de descarga" opciones={destinos.opciones} valor={d.destinoId} onChange={(v) => set("destinoId", v)} />
          <SelectorBuscable etiqueta="Tipo de carga" opciones={cargas.opciones} valor={d.cargoTypeId} onChange={(v) => set("cargoTypeId", v)} />
        </div>
        <p className={`mt-2 text-sm ${nivel ? "text-slate-600" : "text-red-700"}`} role="status">
          {nivel
            ? `Prioridad ${nivel}: ${NIVEL_ETIQUETA[nivel]}.`
            : "Combinación no admitida: indique origen y destino juntos (con o sin tipo de carga), sólo tipo de carga, o ninguno."}
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto etiqueta="Vigencia desde" type="date" value={d.vigenciaDesde} onChange={(e) => set("vigenciaDesde", e.target.value)} obligatorio />
        <CampoTexto etiqueta="Vigencia hasta (opcional)" type="date" value={d.vigenciaHasta} onChange={(e) => set("vigenciaHasta", e.target.value)} ayuda="Vacío = sin fecha de fin." />
      </div>
      <CampoAreaTexto etiqueta="Observaciones" value={d.observaciones} onChange={(e) => set("observaciones", e.target.value)} maxLength={500} />
      <Casilla etiqueta="Tarifa activa" checked={d.activo} onChange={(e) => set("activo", e.target.checked)} />
      {edicion && (
        <CampoAreaTexto
          etiqueta="Motivo del cambio"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          obligatorio
          ayuda="Para actualizar un precio conviene usar «Nueva vigencia», que conserva el historial. Los viajes cerrados no cambian en ningún caso."
        />
      )}
      <Boton type="submit" grande cargando={enviando} disabled={!d.clientId || !d.importe || (edicion && motivo.trim().length < 3)}>
        {edicion ? "Guardar cambios" : "Crear tarifa"}
      </Boton>
    </form>
  );
}

export function cuerpoTarifa(d: DatosTarifa) {
  return {
    ...d,
    unidad: d.modalidad === "POR_PESO" ? d.unidad : null,
    baseCalculo: d.modalidad === "POR_PESO" ? d.baseCalculo : null,
    vigenciaHasta: d.vigenciaHasta || null,
  };
}
