import { describe, expect, it } from "vitest";
import { calcularViaje, diferenciaKg, porcentajeDiferencia, promedioKg } from "@/lib/domain/calculos";
import type { TarifaCalculo } from "@/lib/domain/tipos";
import { normalizeDecimalInput } from "@/lib/domain/decimal";

const cfg = { umbralDiferenciaPct: 2 };
const porKg = (base: TarifaCalculo["baseCalculo"], importe = "1.5", unidad: TarifaCalculo["unidad"] = "KG"): TarifaCalculo => ({
  modalidad: "POR_PESO",
  importe,
  unidad,
  baseCalculo: base,
  moneda: "UYU",
});

describe("cálculo de kilogramos", () => {
  it("calcula el promedio (salida + llegada) / 2 con dos decimales", () => {
    expect(promedioKg("17860", "17850")).toBe("17855.00");
    expect(promedioKg("100.01", "100.02")).toBe("100.02"); // 100.015 redondea hacia arriba
    expect(promedioKg("0", "0")).toBe("0.00");
  });

  it("calcula la diferencia salida - llegada", () => {
    expect(diferenciaKg("28410", "28170")).toBe("240.00");
    expect(diferenciaKg("100", "105.5")).toBe("-5.50");
  });

  it("calcula el porcentaje de diferencia y evita la división por cero", () => {
    expect(porcentajeDiferencia("28410", "28170")).toBe("0.84");
    expect(porcentajeDiferencia("1000", "970")).toBe("3.00");
    expect(porcentajeDiferencia("0", "10")).toBeNull();
  });

  it("no usa coma flotante: 0.1 + 0.2 da exactamente 0.15 de promedio", () => {
    expect(promedioKg("0.1", "0.2")).toBe("0.15");
  });

  it("acepta coma decimal uruguaya en la entrada", () => {
    expect(normalizeDecimalInput("1.234,56")).toBe("1234.56");
    expect(normalizeDecimalInput("1234,5")).toBe("1234.5");
    expect(normalizeDecimalInput(" 1234.5 ")).toBe("1234.5");
  });
});

describe("cálculo de facturación", () => {
  it("facturación fija: importe = tarifa fija", () => {
    const r = calcularViaje(
      { kgSalida: null, kgLlegada: null, tarifa: { modalidad: "FIJO", importe: "26853", unidad: null, baseCalculo: null, moneda: "UYU" } },
      cfg,
    );
    expect(r.importe).toBe("26853.00");
    expect(r.problemas).toEqual([]);
  });

  it("facturación por kg con base promedio: promedioKg × tarifaPorKg", () => {
    const r = calcularViaje({ kgSalida: "1000", kgLlegada: "990", tarifa: porKg("PROMEDIO", "1.5") }, cfg);
    expect(r.kgPromedio).toBe("995.00");
    expect(r.kgBase).toBe("995.00");
    expect(r.importe).toBe("1492.50");
  });

  it("facturación por tonelada divide entre 1000 (como en el Excel actual)", () => {
    const r = calcularViaje({ kgSalida: "17860", kgLlegada: "17850", tarifa: porKg("PROMEDIO", "1500", "TONELADA") }, cfg);
    expect(r.importe).toBe("26782.50");
  });

  it.each([
    ["SALIDA", "1000.00", "1500.00"],
    ["LLEGADA", "980.00", "1470.00"],
    ["PROMEDIO", "990.00", "1485.00"],
    ["MAYOR", "1000.00", "1500.00"],
    ["MENOR", "980.00", "1470.00"],
    ["PROMEDIO_DISPONIBLE", "990.00", "1485.00"],
  ] as const)("base %s", (base, kg, importe) => {
    const r = calcularViaje({ kgSalida: "1000", kgLlegada: "980", tarifa: porKg(base) }, cfg);
    expect(r.kgBase).toBe(kg);
    expect(r.importe).toBe(importe);
  });

  it("base promedio-disponible usa la única medición presente", () => {
    expect(calcularViaje({ kgSalida: "20810", kgLlegada: null, tarifa: porKg("PROMEDIO_DISPONIBLE") }, cfg).kgBase).toBe("20810.00");
    expect(calcularViaje({ kgSalida: null, kgLlegada: "31740", tarifa: porKg("PROMEDIO_DISPONIBLE") }, cfg).kgBase).toBe("31740.00");
  });

  it("informa los kg faltantes según la base", () => {
    const r = calcularViaje({ kgSalida: "1000", kgLlegada: null, tarifa: porKg("PROMEDIO") }, cfg);
    expect(r.importe).toBeNull();
    expect(r.problemas).toContain("Faltan los kg de llegada para calcular el importe.");
  });

  it("sin tarifa no calcula importe", () => {
    const r = calcularViaje({ kgSalida: "1000", kgLlegada: "1000", tarifa: null }, cfg);
    expect(r.importe).toBeNull();
    expect(r.problemas).toContain("No hay una tarifa vigente para este viaje.");
  });

  it("redondea importes a dos decimales (half-up)", () => {
    const r = calcularViaje({ kgSalida: "333.33", kgLlegada: "333.33", tarifa: porKg("SALIDA", "0.015") }, cfg);
    expect(r.importe).toBe("5.00"); // 4.99995
  });

  it("alerta cuando la diferencia supera el umbral (en valor absoluto)", () => {
    expect(calcularViaje({ kgSalida: "1000", kgLlegada: "970", tarifa: null }, cfg).alertaDiferencia).toBe(true);
    expect(calcularViaje({ kgSalida: "1000", kgLlegada: "1030", tarifa: null }, cfg).alertaDiferencia).toBe(true);
    expect(calcularViaje({ kgSalida: "1000", kgLlegada: "980", tarifa: null }, cfg).alertaDiferencia).toBe(false);
    expect(calcularViaje({ kgSalida: "1000", kgLlegada: "980", tarifa: null }, { umbralDiferenciaPct: 1 }).alertaDiferencia).toBe(true);
  });

  it("rechaza valores no numéricos o negativos", () => {
    expect(calcularViaje({ kgSalida: "abc", kgLlegada: null, tarifa: null }, cfg).problemas).toContain("Los kg de salida no son un número válido.");
    expect(calcularViaje({ kgSalida: "-5", kgLlegada: null, tarifa: null }, cfg).problemas).toContain("Los kg de salida no pueden ser negativos.");
  });
});
