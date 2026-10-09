import { ruta } from "@/server/http";
import { recientes } from "@/server/servicios/viajes";

export const GET = ruta({ permiso: "viajes.crear" }, async ({ actor }) => recientes(actor));
