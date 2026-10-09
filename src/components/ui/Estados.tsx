import type { Estado } from "@/lib/domain/tipos";
import { ESTADO_ETIQUETA } from "@/lib/domain/tipos";

const colores: Record<Estado, string> = {
  BORRADOR: "bg-slate-200 text-slate-800 ring-slate-400",
  ABIERTO: "bg-sky-100 text-sky-900 ring-sky-400",
  CERRADO: "bg-emerald-100 text-emerald-900 ring-emerald-500",
  FACTURADO: "bg-violet-100 text-violet-900 ring-violet-400",
  ANULADO: "bg-red-100 text-red-900 ring-red-400 line-through",
};

const iconos: Record<Estado, string> = {
  BORRADOR: "✎",
  ABIERTO: "○",
  CERRADO: "●",
  FACTURADO: "$",
  ANULADO: "✕",
};

export function InsigniaEstado({ estado }: { estado: Estado }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${colores[estado]}`}>
      <span aria-hidden>{iconos[estado]}</span>
      {ESTADO_ETIQUETA[estado]}
    </span>
  );
}

export function InsigniaAlerta({ texto = "Diferencia de peso" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-500">
      <span aria-hidden>⚠</span> {texto}
    </span>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-600" role="status" aria-live="polite">
      <span className="size-5 animate-spin rounded-full border-2 border-marca-700 border-t-transparent" aria-hidden />
      {texto}
    </div>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <p className="font-medium text-slate-800">{titulo}</p>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function Aviso({
  tipo = "info",
  titulo,
  children,
  lista,
}: {
  tipo?: "info" | "error" | "advertencia" | "exito";
  titulo?: string;
  children?: React.ReactNode;
  lista?: string[];
}) {
  const estilos = {
    info: "border-sky-300 bg-sky-50 text-sky-900",
    error: "border-red-300 bg-red-50 text-red-900",
    advertencia: "border-amber-400 bg-amber-50 text-amber-900",
    exito: "border-emerald-300 bg-emerald-50 text-emerald-900",
  }[tipo];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${estilos}`} role={tipo === "error" ? "alert" : "status"}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className={titulo ? "mt-1" : ""}>{children}</div>}
      {lista && lista.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {lista.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErrorCarga({ error, onReintentar }: { error: { message: string } | null; onReintentar?: () => void }) {
  if (!error) return null;
  return (
    <Aviso tipo="error" titulo="No se pudo cargar la información">
      <p>{error.message}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="mt-2 font-semibold underline">
          Reintentar
        </button>
      )}
    </Aviso>
  );
}
