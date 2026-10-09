import { Prisma } from "@prisma/client";
import { dateAFecha } from "@/lib/fechas";

export function dec(v: Prisma.Decimal | null | undefined): string | null {
  return v === null || v === undefined ? null : v.toString();
}

export function fecha(v: Date | null | undefined): string | null {
  return v ? dateAFecha(v) : null;
}

/** Diferencias campo a campo para el registro de auditoría. */
export function diferencias(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
): Record<string, { antes: unknown; despues: unknown }> {
  const out: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const k of Object.keys(despues)) {
    const a = normalizar(antes[k]);
    const d = normalizar(despues[k]);
    if (a !== d) out[k] = { antes: a, despues: d };
  }
  return out;
}

function normalizar(v: unknown): string | number | boolean | null {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return dateAFecha(v);
  if (v instanceof Prisma.Decimal) return v.toString();
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) {
    // "1000" y "1000.00" son el mismo valor
    return new Prisma.Decimal(v).toString();
  }
  if (typeof v === "object") return JSON.stringify(v);
  return v as string | number | boolean;
}
