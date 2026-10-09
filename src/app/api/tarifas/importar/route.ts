import { ruta } from "@/server/http";
import { ErrorValidacion } from "@/server/errores";
import { leerPlantillaTarifas } from "@/server/excel";
import { importarTarifas } from "@/server/servicios/importacion";

const MAX_BYTES = 5 * 1024 * 1024;

export const POST = ruta({ permiso: "tarifas.gestionar" }, async ({ req, actor }) => {
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!archivo || typeof archivo === "string") throw new ErrorValidacion("Adjunte el archivo .xlsx de tarifas.");
  if (archivo.size > MAX_BYTES) throw new ErrorValidacion("El archivo supera los 5 MB.");
  if (!archivo.name.toLowerCase().endsWith(".xlsx")) throw new ErrorValidacion("El archivo debe ser .xlsx.");
  let filas;
  try {
    filas = await leerPlantillaTarifas(await archivo.arrayBuffer());
  } catch {
    throw new ErrorValidacion("No se pudo leer el archivo. Verifique que sea un .xlsx válido.");
  }
  return importarTarifas(actor, filas);
});
