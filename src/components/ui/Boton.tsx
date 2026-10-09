"use client";
import { forwardRef } from "react";

type Variante = "primario" | "secundario" | "peligro" | "exito" | "fantasma";

const estilos: Record<Variante, string> = {
  primario: "bg-marca-700 text-white hover:bg-marca-800 disabled:bg-slate-400",
  secundario: "bg-white text-marca-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  peligro: "bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-400",
  exito: "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-400",
  fantasma: "bg-transparent text-marca-700 hover:bg-marca-50 disabled:text-slate-400",
};

export interface BotonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  grande?: boolean;
  cargando?: boolean;
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = "primario", grande, cargando, className = "", children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${
        grande ? "min-h-12 px-5 text-base" : "min-h-10 px-4 text-sm"
      } ${estilos[variante]} ${className}`}
      {...props}
    >
      {cargando && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});
