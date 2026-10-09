import { leerJson, ruta } from "@/server/http";
import { previsualizar } from "@/server/servicios/viajes";
import { z } from "@/lib/validacion";

export const POST = ruta({}, async ({ req, actor }) => previsualizar(actor, await leerJson(req, z.unknown())));
