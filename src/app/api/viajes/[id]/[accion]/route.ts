import { leerJson, ruta } from "@/server/http";
import { NoEncontrado } from "@/server/errores";
import { anularViaje, cerrarViaje, facturarViaje, reabrirViaje } from "@/server/servicios/viajes";
import { z } from "@/lib/validacion";

const ACCIONES = { cerrar: cerrarViaje, facturar: facturarViaje, anular: anularViaje, reabrir: reabrirViaje } as const;

export const POST = ruta({}, async ({ req, actor, params }) => {
  const fn = ACCIONES[params.accion as keyof typeof ACCIONES];
  if (!fn) throw new NoEncontrado();
  return fn(actor, params.id, await leerJson(req, z.unknown()));
});
