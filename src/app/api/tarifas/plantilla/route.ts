import { ruta } from "@/server/http";
import { prisma } from "@/server/db";
import { plantillaTarifas } from "@/server/excel";
import { obtenerConfiguracion } from "@/server/servicios/configuracion";
import { respuestaArchivo } from "@/server/archivo";

export const GET = ruta({ permiso: "tarifas.gestionar" }, async () => {
  const clientes = await prisma.client.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
  const config = await obtenerConfiguracion();
  const buf = await plantillaTarifas(clientes.map((c) => c.nombre), config.baseCalculoPredeterminada);
  return respuestaArchivo(buf, "plantilla-tarifas.xlsx");
});
