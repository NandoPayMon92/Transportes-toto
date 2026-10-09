import { leerJson, ruta } from "@/server/http";
import { editarViaje, obtenerViaje } from "@/server/servicios/viajes";
import { z } from "@/lib/validacion";

export const GET = ruta({}, async ({ actor, params }) => obtenerViaje(actor, params.id));
export const PUT = ruta({}, async ({ req, actor, params }) => editarViaje(actor, params.id, await leerJson(req, z.unknown())));
