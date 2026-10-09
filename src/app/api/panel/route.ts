import { parametros, ruta } from "@/server/http";
import { panel } from "@/server/servicios/panel";

export const GET = ruta({}, async ({ req, actor }) => panel(actor, parametros(req)));
