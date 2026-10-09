import { leerJson, ruta } from "@/server/http";
import { nuevaVigencia } from "@/server/servicios/tarifas";
import { z } from "@/lib/validacion";

export const POST = ruta({ permiso: "tarifas.gestionar" }, async ({ req, actor, params }) =>
  nuevaVigencia(actor, params.id, await leerJson(req, z.unknown())),
);
