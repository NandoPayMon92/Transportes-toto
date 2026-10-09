import { parametros, ruta } from "@/server/http";
import { exigir } from "@/server/servicios/autorizacion";
import { generarInforme } from "@/server/servicios/informes";
import { libroInforme } from "@/server/excel";
import { respuestaArchivo } from "@/server/archivo";

export const GET = ruta({ permiso: "exportar" }, async ({ req, actor }) => {
  exigir(actor, "informes.operativos");
  const inf = await generarInforme(actor, parametros(req));
  return respuestaArchivo(await libroInforme(inf), `informe-${inf.parametros.agrupacion}-${inf.parametros.desde}-${inf.parametros.hasta}.xlsx`);
});
