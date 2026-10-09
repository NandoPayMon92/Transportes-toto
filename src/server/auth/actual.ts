import { cookies } from "next/headers";
import { actorDesdeToken, COOKIE_SESION, type ActorSesion } from "./sesion";

/** Usuario de la sesión actual (para componentes de servidor). */
export async function usuarioActual(): Promise<ActorSesion | null> {
  const store = await cookies();
  return actorDesdeToken(store.get(COOKIE_SESION)?.value);
}
