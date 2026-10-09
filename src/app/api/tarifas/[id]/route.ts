import { leerJson, ruta } from "@/server/http";
import { actualizarTarifa, obtenerTarifa } from "@/server/servicios/tarifas";
import { z } from "@/lib/validacion";

export const GET = ruta({ permiso: "tarifas.ver" }, async ({ actor, params }) => obtenerTarifa(actor, params.id));
export const PUT = ruta({ permiso: "tarifas.gestionar" }, async ({ req, actor, params }) =>
  actualizarTarifa(actor, params.id, await leerJson(req, z.unknown())),
);
