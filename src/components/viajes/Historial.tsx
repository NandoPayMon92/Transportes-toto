import { formatearFechaHora } from "@/lib/fechas";
import { ESTADO_ETIQUETA, type Estado } from "@/lib/domain/tipos";

const ACCION_ETIQUETA: Record<string, string> = {
  CREAR: "Creó el viaje",
  CREAR_Y_CERRAR: "Creó y cerró el viaje",
  EDITAR: "Modificó el viaje",
  EDITAR_CERRADO: "Modificó el viaje cerrado",
  EDITAR_CERRADO_REAPLICAR_TARIFA: "Modificó el viaje cerrado y reaplicó la tarifa",
  CERRAR: "Cerró el viaje",
  FACTURAR: "Marcó como facturado",
  ANULAR: "Anuló el viaje",
  REABRIR: "Reabrió el viaje",
  // Tarifas
  ACTIVAR: "Activó la tarifa",
  DESACTIVAR: "Desactivó la tarifa",
  CERRAR_VIGENCIA: "Cerró la vigencia",
  NUEVA_VIGENCIA: "Creó una nueva vigencia",
};

const CAMPO_ETIQUETA: Record<string, string> = {
  fecha: "Fecha",
  matricula: "Matrícula",
  cliente: "Cliente",
  chofer: "Chofer",
  tipoCarga: "Tipo de carga",
  cargaDetalle: "Detalle de carga",
  lugarCarga: "Lugar de carga",
  lugarDescarga: "Lugar de descarga",
  kgSalida: "Kg de salida",
  kgLlegada: "Kg de llegada",
  tarifa: "Tarifa",
  modalidad: "Modalidad",
  importeFacturado: "Importe facturado",
  importe: "Importe",
  observaciones: "Observaciones",
  numeroOrden: "Nro. de orden",
  numeroPesada: "Nro. de pesada",
  viaticos: "Viáticos",
  estadias: "Estadías",
  liquidacionCliente: "Liquidación cliente",
  numeroFactura: "Nro. de factura",
  fechaFactura: "Fecha de factura",
  vigenciaDesde: "Vigencia desde",
  vigenciaHasta: "Vigencia hasta",
  activo: "Activa",
  baseCalculo: "Base de cálculo",
  unidad: "Unidad",
  moneda: "Moneda",
};

export interface EntradaHistorial {
  id: string;
  accion: string;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  motivo: string | null;
  cambios: unknown;
  usuario: string;
  fecha: string;
}

function valor(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

export function Historial({ entradas }: { entradas: EntradaHistorial[] }) {
  if (!entradas.length) return <p className="text-sm text-slate-600">Sin movimientos registrados.</p>;
  return (
    <ol className="space-y-4">
      {entradas.map((e) => {
        const cambios = e.cambios && typeof e.cambios === "object" ? (e.cambios as Record<string, unknown>) : null;
        const esDiff = e.accion !== "CREAR" && e.accion !== "CREAR_Y_CERRAR" && cambios;
        const filas = esDiff
          ? Object.entries(cambios!).filter(([, v]) => v && typeof v === "object" && "antes" in (v as object))
          : [];
        return (
          <li key={e.id} className="border-l-2 border-marca-100 pl-3">
            <p className="text-sm">
              <strong>{e.usuario}</strong> · {ACCION_ETIQUETA[e.accion] ?? e.accion}
              {e.estadoAnterior && e.estadoNuevo && e.estadoAnterior !== e.estadoNuevo && (
                <span className="text-slate-600">
                  {" "}
                  ({ESTADO_ETIQUETA[e.estadoAnterior as Estado]} → {ESTADO_ETIQUETA[e.estadoNuevo as Estado]})
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500">{formatearFechaHora(e.fecha)}</p>
            {e.motivo && <p className="mt-1 text-sm text-slate-800">Motivo: {e.motivo}</p>}
            {filas.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                {filas.map(([k, v]) => {
                  const c = v as { antes: unknown; despues: unknown };
                  return (
                    <li key={k}>
                      {CAMPO_ETIQUETA[k] ?? k}: <span className="line-through decoration-slate-400">{valor(c.antes)}</span> → <strong>{valor(c.despues)}</strong>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
