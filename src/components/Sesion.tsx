"use client";
import { createContext, useContext } from "react";
import type { Actor, Permiso } from "@/lib/permisos";
import { tienePermiso } from "@/lib/permisos";

const SesionContexto = createContext<Actor | null>(null);

export function ProveedorSesion({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  return <SesionContexto.Provider value={actor}>{children}</SesionContexto.Provider>;
}

export function useSesion(): Actor {
  const a = useContext(SesionContexto);
  if (!a) throw new Error("Sin sesión");
  return a;
}

/** Sólo controla la visibilidad: la autorización real la hace el servidor. */
export function usePermiso(p: Permiso): boolean {
  return tienePermiso(useContext(SesionContexto), p);
}

export function SiPermiso({ permiso, children, sino = null }: { permiso: Permiso; children: React.ReactNode; sino?: React.ReactNode }) {
  return usePermiso(permiso) ? <>{children}</> : <>{sino}</>;
}

export function RequierePermiso({ permiso, children }: { permiso: Permiso; children: React.ReactNode }) {
  return (
    <SiPermiso
      permiso={permiso}
      sino={
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900" role="alert">
          No tiene permiso para acceder a esta sección.
        </div>
      }
    >
      {children}
    </SiPermiso>
  );
}
