import { formatearImporte, formatearKg, formatearPct, formatearTarifa } from "@/lib/formato";
import { formatearFecha } from "@/lib/fechas";
import { BASE_ETIQUETA, MODALIDAD_ETIQUETA, UNIDAD_ETIQUETA, type TarifaCalculo } from "@/lib/domain/tipos";
import type { ResultadoCalculo } from "@/lib/domain/calculos";
import { InsigniaAlerta } from "@/components/ui/Estados";

interface Props {
  tarifa: (TarifaCalculo & { vigenciaDesde?: string | null; vigenciaHasta?: string | null; nivelEtiqueta?: string | null }) | null;
  calculo: ResultadoCalculo;
  mensajeTarifa?: string | null;
  tipoMensaje?: "error" | "advertencia";
  umbral: number;
  buscando?: boolean;
}

export function ResumenCalculo({ tarifa, calculo, mensajeTarifa, tipoMensaje = "advertencia", umbral, buscando }: Props) {
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tarifa aplicada {buscando && <span className="font-normal normal-case">(buscando…)</span>}</p>
        {tarifa ? (
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-600">Modalidad</dt>
            <dd className="font-medium">{MODALIDAD_ETIQUETA[tarifa.modalidad]}</dd>
            <dt className="text-slate-600">Tarifa</dt>
            <dd className="font-medium tabular">
              {formatearTarifa(tarifa.importe, tarifa.moneda)}
              {tarifa.modalidad === "POR_PESO" && tarifa.unidad ? ` ${UNIDAD_ETIQUETA[tarifa.unidad]}` : " por viaje"}
            </dd>
            {tarifa.modalidad === "POR_PESO" && tarifa.baseCalculo && (
              <>
                <dt className="text-slate-600">Base de cálculo</dt>
                <dd className="font-medium">{BASE_ETIQUETA[tarifa.baseCalculo]}</dd>
              </>
            )}
            {tarifa.vigenciaDesde && (
              <>
                <dt className="text-slate-600">Vigencia</dt>
                <dd className="font-medium">
                  desde {formatearFecha(tarifa.vigenciaDesde)}
                  {tarifa.vigenciaHasta ? ` hasta ${formatearFecha(tarifa.vigenciaHasta)}` : ""}
                </dd>
              </>
            )}
            {tarifa.nivelEtiqueta && (
              <>
                <dt className="text-slate-600">Criterio</dt>
                <dd className="text-slate-700">{tarifa.nivelEtiqueta}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className={`mt-1 text-sm ${tipoMensaje === "error" ? "text-red-700" : "text-amber-800"}`}>{mensajeTarifa ?? "Seleccione un cliente para buscar la tarifa vigente."}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-600">Promedio</dt>
          <dd className="font-semibold tabular">{formatearKg(calculo.kgPromedio)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Diferencia</dt>
          <dd className="font-semibold tabular">
            {formatearKg(calculo.kgDiferencia)} {calculo.porcentajeDiferencia !== null && <span className="text-slate-600">({formatearPct(calculo.porcentajeDiferencia)})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">Kg a facturar</dt>
          <dd className="font-semibold tabular">{formatearKg(calculo.kgBase)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Importe calculado</dt>
          <dd className="text-xl font-bold text-marca-700 tabular">{formatearImporte(calculo.importe, tarifa?.moneda ?? "UYU")}</dd>
        </div>
      </dl>
      {calculo.alertaDiferencia && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <InsigniaAlerta /> La diferencia entre salida y llegada supera el {umbral} %. Indique el motivo en observaciones.
        </div>
      )}
    </div>
  );
}
