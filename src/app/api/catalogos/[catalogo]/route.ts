import { leerJson, parametros, ruta } from "@/server/http";
import { NoEncontrado } from "@/server/errores";
import { crearEnCatalogo, esCatalogo, listarCatalogo } from "@/server/servicios/catalogos";
import { z } from "@/lib/validacion";

export const GET = ruta({}, async ({ req, actor, params }) => {
  if (!esCatalogo(params.catalogo)) throw new NoEncontrado();
  const p = parametros(req);
  return listarCatalogo(actor, params.catalogo, { q: p.q, incluirInactivos: p.inactivos === "true", uso: p.uso });
});

export const POST = ruta({ permiso: "catalogos.gestionar" }, async ({ req, actor, params }) => {
  if (!esCatalogo(params.catalogo)) throw new NoEncontrado();
  return crearEnCatalogo(actor, params.catalogo, await leerJson(req, z.unknown()));
});
