import { parametros, ruta } from "@/server/http";
import { viajesParaExportar } from "@/server/servicios/viajes";
import { libroViajes } from "@/server/excel";
import { respuestaArchivo } from "@/server/archivo";
import { nombresFiltros } from "@/server/servicios/nombres";
import { hoyUruguay } from "@/lib/fechas";

export const GET = ruta({ permiso: "exportar" }, async ({ req, actor }) => {
  const { filtros, items } = await viajesParaExportar(actor, parametros(req));
  const buf = await libroViajes(items, filtros, await nombresFiltros(filtros), actor.nombre);
  return respuestaArchivo(buf, `viajes-${hoyUruguay()}.xlsx`);
});
