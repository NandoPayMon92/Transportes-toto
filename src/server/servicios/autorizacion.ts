import { Prohibido } from "@/server/errores";
import { tienePermiso, type Actor, type Permiso } from "@/lib/permisos";

/** Verifica un permiso en la capa de servicio (no depende de la interfaz). */
export function exigir(actor: Actor | null | undefined, permiso: Permiso): asserts actor is Actor {
  if (!tienePermiso(actor, permiso)) throw new Prohibido();
}
