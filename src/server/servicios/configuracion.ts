import { prisma } from "@/server/db";
import { exigir } from "./autorizacion";
import type { Actor } from "@/lib/permisos";
import { BASES, CONFIGURACION_PREDETERMINADA, type ConfiguracionCalculo } from "@/lib/domain/tipos";
import { z } from "@/lib/validacion";

const CLAVE = "calculo";

export const esquemaConfiguracion = z.object({
  umbralDiferenciaPct: z.coerce.number().min(0).max(100),
  observacionObligatoriaPorDiferencia: z.boolean(),
  bloquearPorDiferencia: z.boolean(),
  exigirAmbosPesos: z.boolean(),
  baseCalculoPredeterminada: z.enum(BASES),
});

export async function obtenerConfiguracion(): Promise<ConfiguracionCalculo> {
  const s = await prisma.setting.findUnique({ where: { clave: CLAVE } });
  const parsed = esquemaConfiguracion.partial().safeParse(s?.valor ?? {});
  return { ...CONFIGURACION_PREDETERMINADA, ...(parsed.success ? parsed.data : {}) };
}

export async function guardarConfiguracion(actor: Actor, input: ConfiguracionCalculo) {
  exigir(actor, "configuracion.gestionar");
  const valor = esquemaConfiguracion.parse(input);
  await prisma.setting.upsert({ where: { clave: CLAVE }, create: { clave: CLAVE, valor }, update: { valor } });
  return obtenerConfiguracion();
}
