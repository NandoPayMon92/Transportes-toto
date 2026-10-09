import { leerJson, ruta } from "@/server/http";
import { esquemaRestablecer, restablecerClave } from "@/server/servicios/auth";

export const POST = ruta({ publica: true }, async ({ req }) => {
  const { token, claveNueva } = await leerJson(req, esquemaRestablecer);
  await restablecerClave(token, claveNueva);
  return { ok: true };
});
