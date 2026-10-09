import { ruta } from "@/server/http";
import { diagnosticoTarifario } from "@/server/servicios/tarifas";

export const GET = ruta({ permiso: "tarifas.ver" }, async ({ actor }) => diagnosticoTarifario(actor));
