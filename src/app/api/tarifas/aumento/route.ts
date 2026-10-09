import { leerJson, ruta } from "@/server/http";
import { aumentoMasivo } from "@/server/servicios/tarifas";
import { z } from "@/lib/validacion";

export const POST = ruta({ permiso: "tarifas.gestionar" }, async ({ req, actor }) => aumentoMasivo(actor, await leerJson(req, z.unknown())));
