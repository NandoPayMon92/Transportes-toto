import { leerJson, parametros, ruta } from "@/server/http";
import { crearViaje, listarViajes } from "@/server/servicios/viajes";
import { z } from "@/lib/validacion";

export const GET = ruta({}, async ({ req, actor }) => listarViajes(actor, parametros(req)));
export const POST = ruta({ permiso: "viajes.crear" }, async ({ req, actor }) => crearViaje(actor, await leerJson(req, z.unknown())));
