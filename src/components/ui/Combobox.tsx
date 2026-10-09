"use client";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Field, Label } from "@headlessui/react";
import { useMemo, useState } from "react";
import { MensajeCampo } from "./Campo";

export interface Opcion {
  valor: string;
  etiqueta: string;
  detalle?: string;
  inactivo?: boolean;
}

interface Props {
  etiqueta: string;
  opciones: Opcion[];
  valor: string | null;
  onChange: (valor: string | null) => void;
  /** Ids usados recientemente: se muestran primero. */
  recientes?: string[];
  placeholder?: string;
  error?: string | null;
  ayuda?: React.ReactNode;
  obligatorio?: boolean;
  deshabilitado?: boolean;
  /** Permite usar lo escrito como texto libre cuando no coincide con ninguna opción. */
  onTextoLibre?: (texto: string) => void;
  textoLibreEtiqueta?: string;
  name?: string;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista desplegable con buscador, accesible con teclado (Headless UI). */
export function SelectorBuscable({
  etiqueta,
  opciones,
  valor,
  onChange,
  recientes = [],
  placeholder = "Buscar…",
  error,
  ayuda,
  obligatorio,
  deshabilitado,
  onTextoLibre,
  textoLibreEtiqueta = "Usar",
  name,
}: Props) {
  const [consulta, setConsulta] = useState("");
  const seleccionada = opciones.find((o) => o.valor === valor) ?? null;

  const ordenadas = useMemo(() => {
    const rec = recientes.map((id) => opciones.find((o) => o.valor === id)).filter((o): o is Opcion => !!o && !o.inactivo);
    const resto = opciones.filter((o) => !recientes.includes(o.valor) && (!o.inactivo || o.valor === valor));
    return { rec, resto };
  }, [opciones, recientes, valor]);

  const q = normalizar(consulta.trim());
  const filtradas = q
    ? [...ordenadas.rec, ...ordenadas.resto].filter((o) => normalizar(o.etiqueta).includes(q))
    : [...ordenadas.rec, ...ordenadas.resto];
  const hayExacta = opciones.some((o) => normalizar(o.etiqueta) === q);

  return (
    <Field disabled={deshabilitado}>
      <Label className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
        {obligatorio && (
          <span className="text-red-700" aria-hidden>
            {" "}*
          </span>
        )}
      </Label>
      <Combobox
        value={seleccionada}
        onChange={(o: Opcion | null) => {
          if (o?.valor === "__libre__") {
            onTextoLibre?.(consulta.trim());
            onChange(null);
          } else onChange(o?.valor ?? null);
        }}
        onClose={() => setConsulta("")}
        immediate
      >
        <div className="relative">
          <ComboboxInput
            name={name}
            aria-invalid={!!error || undefined}
            aria-required={obligatorio || undefined}
            className={`block w-full rounded-lg border bg-white py-2.5 pl-3 pr-10 text-slate-900 shadow-sm focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-100 data-[disabled]:bg-slate-100 ${
              error ? "border-red-600" : "border-slate-300"
            }`}
            displayValue={(o: Opcion | null) => o?.etiqueta ?? ""}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500" aria-label={`Abrir lista de ${etiqueta}`}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
              <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
            </svg>
          </ComboboxButton>
        </div>
        <ComboboxOptions
          anchor="bottom start"
          className="z-50 mt-1 max-h-72 w-[var(--input-width)] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg empty:invisible [--anchor-gap:4px]"
        >
          {!valor ? null : (
            <ComboboxOption value={null} className="cursor-pointer px-3 py-2.5 text-sm text-slate-500 data-[focus]:bg-marca-50">
              — Quitar selección —
            </ComboboxOption>
          )}
          {!q && ordenadas.rec.length > 0 && <div className="px-3 pt-1 text-xs font-semibold uppercase text-slate-500">Recientes</div>}
          {filtradas.map((o, i) => (
            <ComboboxOption
              key={o.valor}
              value={o}
              className={`cursor-pointer px-3 py-2.5 data-[focus]:bg-marca-50 data-[selected]:font-semibold ${
                !q && i === ordenadas.rec.length && ordenadas.rec.length > 0 ? "border-t border-slate-200" : ""
              }`}
            >
              <span>{o.etiqueta}</span>
              {o.detalle && <span className="ml-2 text-xs text-slate-500">{o.detalle}</span>}
              {o.inactivo && <span className="ml-2 text-xs text-amber-700">(inactivo)</span>}
            </ComboboxOption>
          ))}
          {onTextoLibre && q && !hayExacta && (
            <ComboboxOption value={{ valor: "__libre__", etiqueta: consulta.trim() }} className="cursor-pointer border-t border-slate-200 px-3 py-2.5 text-marca-700 data-[focus]:bg-marca-50">
              {textoLibreEtiqueta} “{consulta.trim()}”
            </ComboboxOption>
          )}
          {filtradas.length === 0 && !onTextoLibre && <div className="px-3 py-2.5 text-sm text-slate-500">Sin resultados</div>}
        </ComboboxOptions>
      </Combobox>
      <MensajeCampo id={`${name ?? etiqueta}-msg`} error={error} ayuda={ayuda} />
    </Field>
  );
}
