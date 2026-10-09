import { leerJson, ruta } from "@/server/http";
import { cambiarClave, esquemaCambioClave } from "@/server/servicios/auth";

export const POST = ruta({ permitirClaveVencida: true }, async ({ req, actor }) => {
  const { claveActual, claveNueva } = await leerJson(req, esquemaCambioClave);
  await cambiarClave(actor.id, claveActual, claveNueva);
  return { ok: true };
});
