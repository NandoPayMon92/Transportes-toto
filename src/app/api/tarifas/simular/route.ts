import { parametros, ruta } from "@/server/http";
import { simularTarifa } from "@/server/servicios/tarifas";
import { z, zFecha, zId, zIdOpcional } from "@/lib/validacion";

const esquema = z.object({ clientId: zId, fecha: zFecha, origenId: zIdOpcional, destinoId: zIdOpcional, cargoTypeId: zIdOpcional });

export const GET = ruta({ permiso: "tarifas.ver" }, async ({ req, actor }) => simularTarifa(actor, esquema.parse(parametros(req))));
