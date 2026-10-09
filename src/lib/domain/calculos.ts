import * as D from "./decimal";
import type { Base, ConfiguracionCalculo, TarifaCalculo } from "./tipos";

export interface EntradaCalculo {
  kgSalida: string | null;
  kgLlegada: string | null;
  tarifa: TarifaCalculo | null;
}

export interface ResultadoCalculo {
  kgSalida: string | null;
  kgLlegada: string | null;
  kgPromedio: string | null;
  kgDiferencia: string | null;
  porcentajeDiferencia: string | null;
  kgBase: string | null;
  importe: string | null;
  alertaDiferencia: boolean;
  /** Problemas que impiden calcular el importe (no bloquean un borrador). */
  problemas: string[];
}

const KG_DECIMALES = 2;
const IMPORTE_DECIMALES = 2;

function parseKg(v: string | null): D.Fixed | null {
  if (v === null || v === undefined || v === "") return null;
  return D.round(D.parseFixed(v), KG_DECIMALES);
}

/** promedioKg = (kgSalida + kgLlegada) / 2, redondeado a 2 decimales. */
export function promedioKg(salida: string, llegada: string): string {
  const s = D.parseFixed(salida);
  const l = D.parseFixed(llegada);
  return D.toFixedString(D.div(D.add(s, l), D.parseFixed("2"), KG_DECIMALES), KG_DECIMALES);
}

/** diferenciaKg = kgSalida - kgLlegada */
export function diferenciaKg(salida: string, llegada: string): string {
  return D.toFixedString(D.sub(D.parseFixed(salida), D.parseFixed(llegada)), KG_DECIMALES);
}

/** porcentajeDiferencia = (diferenciaKg / kgSalida) * 100. Devuelve null si kgSalida es 0 (evita división por cero). */
export function porcentajeDiferencia(salida: string, llegada: string): string | null {
  const s = D.parseFixed(salida);
  if (D.isZero(s)) return null;
  const dif = D.sub(s, D.parseFixed(llegada));
  return D.toFixedString(D.div(D.mul(dif, D.parseFixed("100")), s, 2), 2);
}

export const BASE_REQUIERE: Record<Base, { salida: boolean; llegada: boolean }> = {
  SALIDA: { salida: true, llegada: false },
  LLEGADA: { salida: false, llegada: true },
  PROMEDIO: { salida: true, llegada: true },
  MAYOR: { salida: true, llegada: true },
  MENOR: { salida: true, llegada: true },
  PROMEDIO_DISPONIBLE: { salida: false, llegada: false },
};

/** Devuelve los kg sobre los que se factura según la base configurada, o null si faltan datos. */
export function kgBase(base: Base, salida: D.Fixed | null, llegada: D.Fixed | null): D.Fixed | null {
  switch (base) {
    case "SALIDA":
      return salida;
    case "LLEGADA":
      return llegada;
    case "PROMEDIO":
      return salida && llegada ? D.div(D.add(salida, llegada), D.parseFixed("2"), KG_DECIMALES) : null;
    case "MAYOR":
      return salida && llegada ? D.max(salida, llegada) : null;
    case "MENOR":
      return salida && llegada ? D.min(salida, llegada) : null;
    case "PROMEDIO_DISPONIBLE":
      if (salida && llegada) return D.div(D.add(salida, llegada), D.parseFixed("2"), KG_DECIMALES);
      return salida ?? llegada ?? null;
  }
}

/**
 * Calcula importe facturado.
 *  - FIJO: importe = tarifa.
 *  - POR_PESO: importe = kgBase × tarifa (÷ 1000 si la tarifa es por tonelada).
 */
export function importeFacturado(tarifa: TarifaCalculo, base: D.Fixed | null): string | null {
  const t = D.parseFixed(tarifa.importe);
  if (tarifa.modalidad === "FIJO") return D.toFixedString(t, IMPORTE_DECIMALES);
  if (!base) return null;
  const divisor = tarifa.unidad === "TONELADA" ? D.parseFixed("1000") : D.parseFixed("1");
  return D.toFixedString(D.div(D.mul(base, t), divisor, IMPORTE_DECIMALES), IMPORTE_DECIMALES);
}

export function calcularViaje(
  entrada: EntradaCalculo,
  config: Pick<ConfiguracionCalculo, "umbralDiferenciaPct">,
): ResultadoCalculo {
  const problemas: string[] = [];
  let salida: D.Fixed | null = null;
  let llegada: D.Fixed | null = null;
  try {
    salida = parseKg(entrada.kgSalida);
  } catch {
    problemas.push("Los kg de salida no son un número válido.");
  }
  try {
    llegada = parseKg(entrada.kgLlegada);
  } catch {
    problemas.push("Los kg de llegada no son un número válido.");
  }
  if (salida && salida.units < 0n) problemas.push("Los kg de salida no pueden ser negativos.");
  if (llegada && llegada.units < 0n) problemas.push("Los kg de llegada no pueden ser negativos.");

  const sStr = salida ? D.toFixedString(salida, KG_DECIMALES) : null;
  const lStr = llegada ? D.toFixedString(llegada, KG_DECIMALES) : null;

  const prom = sStr && lStr ? promedioKg(sStr, lStr) : null;
  const dif = sStr && lStr ? diferenciaKg(sStr, lStr) : null;
  const pct = sStr && lStr ? porcentajeDiferencia(sStr, lStr) : null;
  const alerta =
    pct !== null && D.cmp(D.abs(D.parseFixed(pct)), D.parseFixed(config.umbralDiferenciaPct)) > 0;

  let base: string | null = null;
  let importe: string | null = null;
  const tarifa = entrada.tarifa;
  if (!tarifa) {
    problemas.push("No hay una tarifa vigente para este viaje.");
  } else if (tarifa.modalidad === "FIJO") {
    importe = importeFacturado(tarifa, null);
    const b = kgBase("PROMEDIO_DISPONIBLE", salida, llegada);
    base = b ? D.toFixedString(b, KG_DECIMALES) : null;
  } else {
    const baseCfg = tarifa.baseCalculo ?? "PROMEDIO";
    const b = kgBase(baseCfg, salida, llegada);
    if (!b) {
      const req = BASE_REQUIERE[baseCfg];
      if (req.salida && !salida) problemas.push("Faltan los kg de salida para calcular el importe.");
      if (req.llegada && !llegada) problemas.push("Faltan los kg de llegada para calcular el importe.");
      if (!req.salida && !req.llegada) problemas.push("Falta al menos una medición de kg para calcular el importe.");
    } else {
      base = D.toFixedString(b, KG_DECIMALES);
      importe = importeFacturado(tarifa, b);
    }
  }

  return {
    kgSalida: sStr,
    kgLlegada: lStr,
    kgPromedio: prom,
    kgDiferencia: dif,
    porcentajeDiferencia: pct,
    kgBase: base,
    importe,
    alertaDiferencia: alerta,
    problemas,
  };
}
