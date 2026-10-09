/** Utilidades de fechas. Las fechas operativas viajan como "YYYY-MM-DD"; se muestran en hora de Uruguay. */

export const ZONA_HORARIA = "America/Montevideo";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function esFechaISO(s: string): boolean {
  if (!FECHA_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Fecha de hoy en Uruguay como YYYY-MM-DD. */
export function hoyUruguay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Convierte YYYY-MM-DD a Date UTC a medianoche (formato de columnas DATE). */
export function fechaADate(s: string): Date {
  return new Date(s + "T00:00:00Z");
}

/** Convierte un Date de columna DATE a YYYY-MM-DD. */
export function dateAFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(s: string, dias: number): string {
  const d = fechaADate(s);
  d.setUTCDate(d.getUTCDate() + dias);
  return dateAFecha(d);
}

export function primerDiaMes(s: string): string {
  return s.slice(0, 8) + "01";
}

export function ultimoDiaMes(s: string): string {
  const [y, m] = s.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return dateAFecha(d);
}

/** dd/mm/aaaa */
export function formatearFecha(s: string | null | undefined): string {
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Fecha y hora en zona de Uruguay. */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
