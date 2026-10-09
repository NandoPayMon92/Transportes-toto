import { leerJson, ruta } from "@/server/http";
import { esquemaConfiguracion, guardarConfiguracion, obtenerConfiguracion } from "@/server/servicios/configuracion";

export const GET = ruta({}, async () => obtenerConfiguracion());
export const PUT = ruta({ permiso: "configuracion.gestionar" }, async ({ req, actor }) =>
  guardarConfiguracion(actor, await leerJson(req, esquemaConfiguracion)),
);
