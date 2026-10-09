import { formatearTarifa } from "@/lib/formato";
import { BASE_ETIQUETA, UNIDAD_ETIQUETA } from "@/lib/domain/tipos";
import type { TarifaDTO } from "@/server/servicios/tarifas";

export function TextoTarifa({ t }: { t: Pick<TarifaDTO, "modalidad" | "importe" | "moneda" | "unidad" | "baseCalculo"> }) {
  return (
    <span className="tabular">
      <strong>{formatearTarifa(t.importe, t.moneda)}</strong>{" "}
      {t.modalidad === "FIJO" ? "por viaje" : `${t.unidad ? UNIDAD_ETIQUETA[t.unidad] : ""} · ${t.baseCalculo ? BASE_ETIQUETA[t.baseCalculo] : ""}`}
    </span>
  );
}

export function alcance(t: Pick<TarifaDTO, "origen" | "destino" | "cargoType">): string {
  const partes = [];
  if (t.origen || t.destino) partes.push(`${t.origen ?? "?"} → ${t.destino ?? "?"}`);
  if (t.cargoType) partes.push(t.cargoType);
  return partes.length ? partes.join(" · ") : "General del cliente";
}
