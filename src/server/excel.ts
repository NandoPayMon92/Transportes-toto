import ExcelJS from "exceljs";
import { fechaADate, formatearFecha } from "@/lib/fechas";
import { BASE_ETIQUETA, ESTADO_ETIQUETA, MODALIDAD_ETIQUETA, UNIDAD_ETIQUETA, type Base, type Estado, type Modalidad, type Unidad } from "@/lib/domain/tipos";
import type { ViajeDTO, FiltrosViaje } from "./servicios/viajes";
import type { generarInforme } from "./servicios/informes";

const FORMATO_KG = "#,##0.00";
const FORMATO_IMPORTE = "#,##0.00";
const FORMATO_TARIFA = "#,##0.00##";
const FORMATO_PCT = "0.00";
const FORMATO_FECHA = "dd/mm/yyyy";

/** Convierte un string decimal en número real para la celda (nunca texto). */
const num = (v: string | null | undefined): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

function estiloEncabezado(ws: ExcelJS.Worksheet) {
  const fila = ws.getRow(1);
  fila.font = { bold: true, color: { argb: "FFFFFFFF" } };
  fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  fila.alignment = { vertical: "middle", wrapText: true };
  fila.height = 30;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

export const COLUMNAS_VIAJES: Array<{ header: string; key: string; width: number; numFmt?: string }> = [
  { header: "ID del viaje", key: "numero", width: 10 },
  { header: "Fecha", key: "fecha", width: 12, numFmt: FORMATO_FECHA },
  { header: "Cliente", key: "cliente", width: 22 },
  { header: "Matrícula", key: "matricula", width: 12 },
  { header: "Chofer", key: "chofer", width: 22 },
  { header: "Carga", key: "carga", width: 24 },
  { header: "Lugar de carga", key: "origen", width: 20 },
  { header: "Lugar de descarga", key: "destino", width: 20 },
  { header: "Kg de salida", key: "kgSalida", width: 13, numFmt: FORMATO_KG },
  { header: "Kg de llegada", key: "kgLlegada", width: 13, numFmt: FORMATO_KG },
  { header: "Promedio de kg", key: "kgPromedio", width: 14, numFmt: FORMATO_KG },
  { header: "Diferencia de kg", key: "kgDiferencia", width: 14, numFmt: FORMATO_KG },
  { header: "Porcentaje de diferencia (%)", key: "porcentajeDiferencia", width: 14, numFmt: FORMATO_PCT },
  { header: "Kg facturados (base)", key: "kgBase", width: 14, numFmt: FORMATO_KG },
  { header: "Modalidad de facturación", key: "modalidad", width: 16 },
  { header: "Tarifa aplicada", key: "tarifa", width: 13, numFmt: FORMATO_TARIFA },
  { header: "Unidad de la tarifa", key: "unidad", width: 18 },
  { header: "Base de cálculo", key: "base", width: 22 },
  { header: "Moneda", key: "moneda", width: 8 },
  { header: "Importe facturado", key: "importe", width: 15, numFmt: FORMATO_IMPORTE },
  { header: "Estado", key: "estado", width: 11 },
  { header: "Observaciones", key: "observaciones", width: 40 },
  { header: "Nro. de orden", key: "numeroOrden", width: 12 },
  { header: "Nro. de pesada", key: "numeroPesada", width: 12 },
  { header: "Viáticos", key: "viaticos", width: 9 },
  { header: "Estadías", key: "estadias", width: 9 },
  { header: "Liquidación cliente", key: "liquidacionCliente", width: 15, numFmt: FORMATO_IMPORTE },
  { header: "Nro. de factura", key: "numeroFactura", width: 13 },
  { header: "Fecha de factura", key: "fechaFactura", width: 12, numFmt: FORMATO_FECHA },
  { header: "Motivo de anulación", key: "motivoAnulacion", width: 30 },
];

export function filaViaje(v: ViajeDTO) {
  return {
    numero: v.numero,
    fecha: fechaADate(v.fecha),
    cliente: v.cliente ?? "",
    matricula: v.matricula ?? "",
    chofer: v.chofer ?? "",
    carga: v.carga ?? "",
    origen: v.origen ?? "",
    destino: v.destino ?? "",
    kgSalida: num(v.kgSalida),
    kgLlegada: num(v.kgLlegada),
    kgPromedio: num(v.kgPromedio),
    kgDiferencia: num(v.kgDiferencia),
    porcentajeDiferencia: num(v.porcentajeDiferencia),
    kgBase: num(v.kgBase),
    modalidad: v.tarifaModalidad ? MODALIDAD_ETIQUETA[v.tarifaModalidad as Modalidad] : "",
    tarifa: num(v.tarifaImporte),
    unidad: v.tarifaModalidad === "POR_PESO" && v.tarifaUnidad ? UNIDAD_ETIQUETA[v.tarifaUnidad as Unidad] : "",
    base: v.tarifaModalidad === "POR_PESO" && v.tarifaBase ? BASE_ETIQUETA[v.tarifaBase as Base] : "",
    moneda: v.moneda,
    importe: num(v.importeFacturado),
    estado: ESTADO_ETIQUETA[v.estado as Estado],
    observaciones: v.observaciones ?? "",
    numeroOrden: v.numeroOrden ?? "",
    numeroPesada: v.numeroPesada ?? "",
    viaticos: v.viaticos,
    estadias: v.estadias,
    liquidacionCliente: num(v.liquidacionCliente),
    numeroFactura: v.numeroFactura ?? "",
    fechaFactura: v.fechaFactura ? fechaADate(v.fechaFactura) : null,
    motivoAnulacion: v.motivoAnulacion ?? "",
  };
}

function describirFiltros(f: FiltrosViaje, nombres: Record<string, string>): string[] {
  const out: string[] = [];
  if (f.desde) out.push(`Desde: ${formatearFecha(f.desde)}`);
  if (f.hasta) out.push(`Hasta: ${formatearFecha(f.hasta)}`);
  for (const k of ["clientId", "vehicleId", "driverId", "cargoTypeId", "origenId", "destinoId"] as const) {
    if (f[k]) out.push(`${nombres[k + ":label"] ?? k}: ${nombres[k] ?? f[k]}`);
  }
  if (f.estado.length) out.push(`Estado: ${f.estado.map((e) => ESTADO_ETIQUETA[e]).join(", ")}`);
  if (f.modalidad) out.push(`Modalidad: ${MODALIDAD_ETIQUETA[f.modalidad]}`);
  if (f.conDiferencia) out.push("Sólo con diferencias de peso");
  if (f.pendientesFacturar) out.push("Sólo pendientes de facturar");
  if (f.sinTarifa) out.push("Sólo sin tarifa");
  return out.length ? out : ["Sin filtros"];
}

export async function libroViajes(items: ViajeDTO[], filtros: FiltrosViaje, nombres: Record<string, string>, generadoPor: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Transportes Toto";
  wb.created = new Date();
  const ws = wb.addWorksheet("Viajes");
  ws.columns = COLUMNAS_VIAJES.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  for (const v of items) ws.addRow(filaViaje(v));
  estiloEncabezado(ws);

  const info = wb.addWorksheet("Filtros");
  info.columns = [{ header: "Filtros aplicados", key: "f", width: 60 }];
  for (const linea of describirFiltros(filtros, nombres)) info.addRow({ f: linea });
  info.addRow({ f: `Registros exportados: ${items.length}` });
  info.addRow({ f: `Generado por: ${generadoPor}` });
  info.addRow({ f: `Generado el: ${new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", dateStyle: "short", timeStyle: "short" }).format(new Date())}` });
  info.getRow(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

type Informe = Awaited<ReturnType<typeof generarInforme>>;

export async function libroInforme(inf: Informe) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Transportes Toto";
  const ws = wb.addWorksheet("Informe");
  const cols: Array<{ header: string; key: string; width: number; numFmt?: string }> = [
    { header: inf.agrupacionEtiqueta, key: "grupo", width: 26 },
    { header: "Moneda", key: "moneda", width: 8 },
    { header: "Cantidad de viajes", key: "viajes", width: 12 },
    { header: "Kg transportados", key: "kgTransportados", width: 16, numFmt: FORMATO_KG },
    { header: "Toneladas", key: "toneladas", width: 12, numFmt: "#,##0.000" },
    { header: "Kg de salida", key: "kgSalida", width: 15, numFmt: FORMATO_KG },
    { header: "Kg de llegada", key: "kgLlegada", width: 15, numFmt: FORMATO_KG },
    { header: "Diferencia de kg", key: "diferenciaKg", width: 14, numFmt: FORMATO_KG },
    { header: "Viajes con alerta de diferencia", key: "viajesConAlerta", width: 14 },
  ];
  if (inf.verImportes) {
    cols.push(
      { header: "Importe facturado", key: "importe", width: 16, numFmt: FORMATO_IMPORTE },
      { header: "Importe promedio por viaje", key: "importePromedioViaje", width: 16, numFmt: FORMATO_IMPORTE },
      { header: "Tarifa promedio por tonelada", key: "tarifaPromedioTonelada", width: 16, numFmt: FORMATO_IMPORTE },
    );
    if (inf.parametros.agrupacion === "mes") cols.push({ header: "Variación vs. mes anterior (%)", key: "variacionImportePct", width: 16, numFmt: FORMATO_PCT });
  }
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  for (const f of inf.filas) {
    ws.addRow({
      grupo: f.grupo,
      moneda: f.moneda,
      viajes: f.viajes,
      kgTransportados: num(f.kgTransportados),
      toneladas: num(f.toneladas),
      kgSalida: num(f.kgSalida),
      kgLlegada: num(f.kgLlegada),
      diferenciaKg: num(f.diferenciaKg),
      viajesConAlerta: f.viajesConAlerta,
      importe: num(f.importe),
      importePromedioViaje: num(f.importePromedioViaje),
      tarifaPromedioTonelada: num(f.tarifaPromedioTonelada),
      variacionImportePct: num(f.variacionImportePct),
    });
  }
  for (const t of inf.totales) {
    const r = ws.addRow({ grupo: "TOTAL", moneda: t.moneda, viajes: t.viajes, kgTransportados: num(t.kgTransportados), viajesConAlerta: t.viajesConAlerta, importe: num(t.importe) });
    r.font = { bold: true };
  }
  estiloEncabezado(ws);
  const info = wb.addWorksheet("Parámetros");
  info.columns = [{ header: "Parámetro", key: "k", width: 25 }, { header: "Valor", key: "v", width: 40 }];
  info.addRow({ k: "Agrupación", v: inf.agrupacionEtiqueta });
  info.addRow({ k: "Desde", v: formatearFecha(inf.parametros.desde) });
  info.addRow({ k: "Hasta", v: formatearFecha(inf.parametros.hasta) });
  info.addRow({ k: "Estados incluidos", v: inf.parametros.estados.map((e) => ESTADO_ETIQUETA[e as Estado]).join(", ") });
  info.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// Plantilla e importación de tarifas
// ---------------------------------------------------------------------------

export const COLUMNAS_PLANTILLA = [
  "Cliente",
  "Modalidad (FIJO / POR_PESO)",
  "Importe",
  "Moneda (UYU / USD)",
  "Unidad (KG / TONELADA)",
  "Base de cálculo",
  "Lugar de carga",
  "Lugar de descarga",
  "Tipo de carga",
  "Vigencia desde (dd/mm/aaaa)",
  "Vigencia hasta (dd/mm/aaaa)",
  "Observaciones",
];

export async function plantillaTarifas(clientes: string[], baseSugerida: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tarifas");
  ws.columns = COLUMNAS_PLANTILLA.map((h) => ({ header: h, width: Math.max(14, h.length + 2) }));
  for (const c of clientes) {
    // Filas pendientes de configuración: sin importe (no se inventan tarifas). Se omiten al importar si siguen vacías.
    ws.addRow([c, "POR_PESO", null, "UYU", "TONELADA", baseSugerida, "", "", "", "", "", "PENDIENTE DE CONFIGURACIÓN"]);
  }
  estiloEncabezado(ws);
  const ayuda = wb.addWorksheet("Instrucciones");
  ayuda.columns = [{ header: "Instrucciones", width: 110 }];
  [
    "Complete una fila por tarifa. Las filas sin importe se consideran pendientes y se omiten al importar.",
    "Cliente: debe existir en la aplicación (se compara sin distinguir mayúsculas).",
    "Modalidad: FIJO (importe por viaje) o POR_PESO (importe por kg o por tonelada).",
    "Unidad y base de cálculo: sólo para POR_PESO. Unidad KG o TONELADA.",
    "Base de cálculo: SALIDA, LLEGADA, PROMEDIO, MAYOR, MENOR o PROMEDIO_DISPONIBLE (promedio, o la medición disponible si falta una).",
    "Lugares y tipo de carga son opcionales. Combinaciones válidas: origen + destino (+ carga opcional), sólo carga, o ninguno.",
    "Si un lugar o tipo de carga no existe, se crea automáticamente.",
    "Vigencia desde es obligatoria. Vigencia hasta es opcional (vacía = sin fecha de fin).",
    "La importación es todo o nada: si una fila tiene errores, no se importa ninguna y se informa el detalle.",
  ].forEach((t) => ayuda.addRow([t]));
  ayuda.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface FilaImportacion {
  fila: number;
  cliente: string;
  modalidad: string;
  importe: string;
  moneda: string;
  unidad: string;
  baseCalculo: string;
  origen: string;
  destino: string;
  carga: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  observaciones: string;
}

function celdaTexto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return celdaTexto(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
  }
  return String(v).trim();
}

/** Acepta fechas reales de Excel, AAAA-MM-DD o dd/mm/aaaa. */
export function normalizarFecha(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s;
}

export async function leerPlantillaTarifas(buffer: ArrayBuffer): Promise<FilaImportacion[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Tarifas") ?? wb.worksheets[0];
  if (!ws) return [];
  const filas: FilaImportacion[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const c = (i: number) => celdaTexto(row.getCell(i).value);
    if (!c(1) && !c(3)) return;
    filas.push({
      fila: n,
      cliente: c(1),
      modalidad: c(2).toUpperCase(),
      importe: c(3),
      moneda: c(4).toUpperCase() || "UYU",
      unidad: c(5).toUpperCase(),
      baseCalculo: c(6).toUpperCase(),
      origen: c(7),
      destino: c(8),
      carga: c(9),
      vigenciaDesde: normalizarFecha(c(10)),
      vigenciaHasta: normalizarFecha(c(11)),
      observaciones: c(12),
    });
  });
  return filas;
}
