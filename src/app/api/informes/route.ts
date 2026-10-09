import { parametros, ruta } from "@/server/http";
import { generarInforme } from "@/server/servicios/informes";

export const GET = ruta({ permiso: "informes.operativos" }, async ({ req, actor }) => generarInforme(actor, parametros(req)));
