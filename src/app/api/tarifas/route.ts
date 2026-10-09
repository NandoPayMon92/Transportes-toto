import { leerJson, parametros, ruta } from "@/server/http";
import { crearTarifa, listarTarifas } from "@/server/servicios/tarifas";
import { z } from "@/lib/validacion";

export const GET = ruta({ permiso: "tarifas.ver" }, async ({ req, actor }) => {
  const p = parametros(req);
  return listarTarifas(actor, { clientId: p.clientId || undefined, incluirInactivas: p.inactivas === "true", vigentes: p.vigentes === "true" });
});

export const POST = ruta({ permiso: "tarifas.gestionar" }, async ({ req, actor }) => crearTarifa(actor, await leerJson(req, z.unknown())));
