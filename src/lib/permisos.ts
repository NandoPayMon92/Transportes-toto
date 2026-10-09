import type { Rol } from "./domain/tipos";

/**
 * Matriz de permisos por rol. Es la única fuente de verdad: la usa el backend para autorizar
 * cada operación y el frontend sólo para decidir qué mostrar.
 */
export const PERMISOS = {
  "usuarios.gestionar": ["ADMIN"],
  "catalogos.gestionar": ["ADMIN"],
  "configuracion.gestionar": ["ADMIN"],
  "tarifas.gestionar": ["ADMIN"],
  "tarifas.ver": ["ADMIN", "LOGISTICA", "CONSULTA"],
  "viajes.crear": ["ADMIN", "LOGISTICA"],
  "viajes.editarAbierto": ["ADMIN", "LOGISTICA"],
  "viajes.cerrar": ["ADMIN", "LOGISTICA"],
  "viajes.editarCerrado": ["ADMIN"],
  "viajes.reabrir": ["ADMIN"],
  "viajes.facturar": ["ADMIN"],
  "viajes.anular": ["ADMIN"],
  /** Ver viajes en cualquier estado. Sin este permiso sólo se ven cerrados y facturados. */
  "viajes.verTodos": ["ADMIN", "LOGISTICA"],
  "informes.operativos": ["ADMIN", "LOGISTICA", "CONSULTA"],
  "informes.facturacion": ["ADMIN", "CONSULTA"],
  "auditoria.ver": ["ADMIN"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS | "exportar";

export interface Actor {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  puedeExportar: boolean;
}

export function tienePermiso(actor: Pick<Actor, "rol" | "puedeExportar"> | null | undefined, permiso: Permiso): boolean {
  if (!actor) return false;
  if (permiso === "exportar") {
    // Administración y consulta exportan siempre; logística sólo si se le otorgó el permiso.
    return actor.rol === "ADMIN" || actor.rol === "CONSULTA" || (actor.rol === "LOGISTICA" && actor.puedeExportar);
  }
  return (PERMISOS[permiso] as readonly Rol[]).includes(actor.rol);
}
