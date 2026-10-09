/** Formato de números para la interfaz (es-UY: punto de miles, coma decimal). */

const kgFmt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const moneyFmt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tarifaFmt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const SIMBOLO_MONEDA: Record<string, string> = { UYU: "$", USD: "US$" };

export function formatearKg(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return kgFmt.format(Number(v)) + " kg";
}

export function formatearImporte(v: string | number | null | undefined, moneda = "UYU"): string {
  if (v === null || v === undefined || v === "") return "—";
  return `${SIMBOLO_MONEDA[moneda] ?? moneda} ${moneyFmt.format(Number(v))}`;
}

export function formatearTarifa(v: string | number | null | undefined, moneda = "UYU"): string {
  if (v === null || v === undefined || v === "") return "—";
  return `${SIMBOLO_MONEDA[moneda] ?? moneda} ${tarifaFmt.format(Number(v))}`;
}

export function formatearPct(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return moneyFmt.format(Number(v)) + " %";
}

export function formatearNumero(v: string | number | null | undefined, dec = 2): string {
  if (v === null || v === undefined || v === "") return "—";
  return new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(Number(v));
}
