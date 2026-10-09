/**
 * Reglas puras de selección de tarifas.
 *
 * Niveles de especificidad (1 = más específica):
 *   1. Cliente + origen + destino + tipo de carga
 *   2. Cliente + origen + destino
 *   3. Cliente + tipo de carga
 *   4. Cliente
 */

export interface TarifaClave {
  id: string;
  clientId: string;
  origenId: string | null;
  destinoId: string | null;
  cargoTypeId: string | null;
  vigenciaDesde: string; // YYYY-MM-DD
  vigenciaHasta: string | null; // YYYY-MM-DD
  activo: boolean;
}

export interface CriterioViaje {
  clientId: string;
  fecha: string; // YYYY-MM-DD
  origenId: string | null;
  destinoId: string | null;
  cargoTypeId: string | null;
}

export type NivelTarifa = 1 | 2 | 3 | 4;

export const NIVEL_ETIQUETA: Record<NivelTarifa, string> = {
  1: "Cliente + origen + destino + tipo de carga",
  2: "Cliente + origen + destino",
  3: "Cliente + tipo de carga",
  4: "Cliente (general)",
};

/** Devuelve el nivel de la tarifa o null si la combinación de campos opcionales no es admitida. */
export function nivelTarifa(t: Pick<TarifaClave, "origenId" | "destinoId" | "cargoTypeId">): NivelTarifa | null {
  const o = !!t.origenId;
  const d = !!t.destinoId;
  const c = !!t.cargoTypeId;
  if (o && d && c) return 1;
  if (o && d && !c) return 2;
  if (!o && !d && c) return 3;
  if (!o && !d && !c) return 4;
  return null;
}

export function vigenteEn(t: Pick<TarifaClave, "vigenciaDesde" | "vigenciaHasta">, fecha: string): boolean {
  return t.vigenciaDesde <= fecha && (t.vigenciaHasta === null || t.vigenciaHasta >= fecha);
}

export function vigenciasSuperpuestas(
  a: Pick<TarifaClave, "vigenciaDesde" | "vigenciaHasta">,
  b: Pick<TarifaClave, "vigenciaDesde" | "vigenciaHasta">,
): boolean {
  const aFin = a.vigenciaHasta ?? "9999-12-31";
  const bFin = b.vigenciaHasta ?? "9999-12-31";
  return a.vigenciaDesde <= bFin && b.vigenciaDesde <= aFin;
}

export function mismaClave(a: TarifaClave, b: TarifaClave): boolean {
  return (
    a.clientId === b.clientId &&
    (a.origenId ?? null) === (b.origenId ?? null) &&
    (a.destinoId ?? null) === (b.destinoId ?? null) &&
    (a.cargoTypeId ?? null) === (b.cargoTypeId ?? null)
  );
}

export function aplicaA(t: TarifaClave, v: CriterioViaje): boolean {
  if (!t.activo || t.clientId !== v.clientId || !vigenteEn(t, v.fecha)) return false;
  if (t.origenId && t.origenId !== v.origenId) return false;
  if (t.destinoId && t.destinoId !== v.destinoId) return false;
  if (t.cargoTypeId && t.cargoTypeId !== v.cargoTypeId) return false;
  return nivelTarifa(t) !== null;
}

export type ResultadoSeleccion<T extends TarifaClave> =
  | { tipo: "OK"; tarifa: T; nivel: NivelTarifa }
  | { tipo: "SIN_TARIFA" }
  | { tipo: "CONFLICTO"; nivel: NivelTarifa; tarifas: T[] };

/**
 * Elige la tarifa más específica que aplica al viaje.
 * Si hay más de una en el nivel ganador, NO elige: informa un conflicto de configuración.
 */
export function seleccionarTarifa<T extends TarifaClave>(candidatas: T[], viaje: CriterioViaje): ResultadoSeleccion<T> {
  const aplicables = candidatas.filter((t) => aplicaA(t, viaje));
  for (const nivel of [1, 2, 3, 4] as NivelTarifa[]) {
    const delNivel = aplicables.filter((t) => nivelTarifa(t) === nivel);
    if (delNivel.length === 1) return { tipo: "OK", tarifa: delNivel[0], nivel };
    if (delNivel.length > 1) return { tipo: "CONFLICTO", nivel, tarifas: delNivel };
  }
  return { tipo: "SIN_TARIFA" };
}

/** Pares de tarifas activas con la misma clave y vigencias superpuestas (errores de configuración). */
export function detectarConflictos<T extends TarifaClave>(tarifas: T[]): Array<[T, T]> {
  const activas = tarifas.filter((t) => t.activo);
  const pares: Array<[T, T]> = [];
  for (let i = 0; i < activas.length; i++) {
    for (let j = i + 1; j < activas.length; j++) {
      if (mismaClave(activas[i], activas[j]) && vigenciasSuperpuestas(activas[i], activas[j])) {
        pares.push([activas[i], activas[j]]);
      }
    }
  }
  return pares;
}
