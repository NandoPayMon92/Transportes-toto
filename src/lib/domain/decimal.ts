/**
 * Aritmética decimal de punto fijo basada en BigInt.
 * Evita los errores de redondeo de los números de coma flotante en kilos e importes.
 * Se usa tanto en el navegador (cálculo en tiempo real) como en el servidor (cálculo oficial),
 * por lo que ambos producen exactamente el mismo resultado.
 */

/** Valor decimal representado como entero escalado: valor = units / 10^scale */
export interface Fixed {
  units: bigint;
  scale: number;
}

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export function isDecimalString(value: string): boolean {
  return DECIMAL_RE.test(value.trim());
}

/** Normaliza entradas de usuario: admite coma decimal ("1234,5") y separadores de miles con punto ("1.234,5"). */
export function normalizeDecimalInput(raw: string): string {
  let s = raw.trim().replace(/\s/g, "");
  if (s.includes(",")) {
    // Formato uruguayo: punto de miles, coma decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  }
  return s;
}

export function parseFixed(value: string | number): Fixed {
  const s = typeof value === "number" ? numberToPlainString(value) : value.trim();
  if (!isDecimalString(s)) throw new Error(`Número inválido: ${value}`);
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  const [intPart, fracPart = ""] = body.split(".");
  const units = BigInt(intPart + fracPart) * (negative ? -1n : 1n);
  return { units, scale: fracPart.length };
}

function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) throw new Error("Número inválido");
  // toFixed evita la notación exponencial para los rangos que maneja la aplicación.
  return n.toFixed(10).replace(/\.?0+$/, "");
}

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

function rescale(a: Fixed, scale: number): bigint {
  if (scale < a.scale) throw new Error("rescale sólo aumenta la escala");
  return a.units * pow10(scale - a.scale);
}

export function add(a: Fixed, b: Fixed): Fixed {
  const scale = Math.max(a.scale, b.scale);
  return { units: rescale(a, scale) + rescale(b, scale), scale };
}

export function sub(a: Fixed, b: Fixed): Fixed {
  const scale = Math.max(a.scale, b.scale);
  return { units: rescale(a, scale) - rescale(b, scale), scale };
}

export function mul(a: Fixed, b: Fixed): Fixed {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

export function cmp(a: Fixed, b: Fixed): number {
  const scale = Math.max(a.scale, b.scale);
  const x = rescale(a, scale);
  const y = rescale(b, scale);
  return x === y ? 0 : x > y ? 1 : -1;
}

export function isZero(a: Fixed): boolean {
  return a.units === 0n;
}

/** División con redondeo "half away from zero" al número de decimales indicado. */
export function div(a: Fixed, b: Fixed, decimals: number): Fixed {
  if (b.units === 0n) throw new Error("División por cero");
  // a/b = (a.units/10^as) / (b.units/10^bs) = a.units * 10^bs / (b.units * 10^as)
  // Se calcula con una cifra extra para redondear.
  const extra = decimals + 1;
  let num = a.units * pow10(b.scale + extra);
  let den = b.units * pow10(a.scale);
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const q = num / den; // trunca hacia cero
  return round({ units: q, scale: extra }, decimals);
}

/** Redondeo "half away from zero" (redondeo comercial). */
export function round(a: Fixed, decimals: number): Fixed {
  if (a.scale <= decimals) return { units: rescale(a, decimals), scale: decimals };
  const factor = pow10(a.scale - decimals);
  const negative = a.units < 0n;
  const abs = negative ? -a.units : a.units;
  let q = abs / factor;
  const r = abs % factor;
  if (r * 2n >= factor) q += 1n;
  return { units: negative ? -q : q, scale: decimals };
}

export function toFixedString(a: Fixed, decimals: number): string {
  const r = round(a, decimals);
  const negative = r.units < 0n;
  const abs = (negative ? -r.units : r.units).toString().padStart(decimals + 1, "0");
  const intPart = abs.slice(0, abs.length - decimals) || "0";
  const frac = decimals > 0 ? "." + abs.slice(abs.length - decimals) : "";
  return (negative ? "-" : "") + intPart + frac;
}

export function abs(a: Fixed): Fixed {
  return a.units < 0n ? { units: -a.units, scale: a.scale } : a;
}

export function max(a: Fixed, b: Fixed): Fixed {
  return cmp(a, b) >= 0 ? a : b;
}

export function min(a: Fixed, b: Fixed): Fixed {
  return cmp(a, b) <= 0 ? a : b;
}
