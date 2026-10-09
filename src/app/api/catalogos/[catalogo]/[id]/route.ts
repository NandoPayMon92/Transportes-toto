import { leerJson, ruta } from "@/server/http";
import { NoEncontrado } from "@/server/errores";
import { actualizarEnCatalogo, eliminarDeCatalogo, esCatalogo } from "@/server/servicios/catalogos";
import { z } from "@/lib/validacion";

export const PUT = ruta({ permiso: "catalogos.gestionar" }, async ({ req, actor, params }) => {
  if (!esCatalogo(params.catalogo)) throw new NoEncontrado();
  return actualizarEnCatalogo(actor, params.catalogo, params.id, await leerJson(req, z.unknown()));
});

export const DELETE = ruta({ permiso: "catalogos.gestionar" }, async ({ actor, params }) => {
  if (!esCatalogo(params.catalogo)) throw new NoEncontrado();
  await eliminarDeCatalogo(actor, params.catalogo, params.id);
  return { ok: true };
});
