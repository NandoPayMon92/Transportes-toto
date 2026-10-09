import { describe, expect, it } from "vitest";
import { detectarConflictos, nivelTarifa, seleccionarTarifa, type TarifaClave } from "@/lib/domain/tarifas";

let n = 0;
const t = (p: Partial<TarifaClave>): TarifaClave => ({
  id: `t${++n}`,
  clientId: "c1",
  origenId: null,
  destinoId: null,
  cargoTypeId: null,
  vigenciaDesde: "2026-01-01",
  vigenciaHasta: null,
  activo: true,
  ...p,
});
const viaje = { clientId: "c1", fecha: "2026-06-15", origenId: "o1", destinoId: "d1", cargoTypeId: "k1" };

describe("selección de tarifas", () => {
  it("clasifica niveles y rechaza combinaciones no admitidas", () => {
    expect(nivelTarifa({ origenId: "o", destinoId: "d", cargoTypeId: "k" })).toBe(1);
    expect(nivelTarifa({ origenId: "o", destinoId: "d", cargoTypeId: null })).toBe(2);
    expect(nivelTarifa({ origenId: null, destinoId: null, cargoTypeId: "k" })).toBe(3);
    expect(nivelTarifa({ origenId: null, destinoId: null, cargoTypeId: null })).toBe(4);
    expect(nivelTarifa({ origenId: "o", destinoId: null, cargoTypeId: null })).toBeNull();
  });

  it("elige la más específica", () => {
    const general = t({});
    const porCarga = t({ cargoTypeId: "k1" });
    const ruta = t({ origenId: "o1", destinoId: "d1" });
    const completa = t({ origenId: "o1", destinoId: "d1", cargoTypeId: "k1" });
    expect(seleccionarTarifa([general, porCarga, ruta, completa], viaje)).toMatchObject({ tipo: "OK", tarifa: completa, nivel: 1 });
    expect(seleccionarTarifa([general, porCarga, ruta], viaje)).toMatchObject({ tipo: "OK", tarifa: ruta, nivel: 2 });
    expect(seleccionarTarifa([general, porCarga], viaje)).toMatchObject({ tipo: "OK", tarifa: porCarga, nivel: 3 });
    expect(seleccionarTarifa([general], viaje)).toMatchObject({ tipo: "OK", tarifa: general, nivel: 4 });
  });

  it("respeta la vigencia, el cliente y el estado activo", () => {
    expect(seleccionarTarifa([t({ vigenciaDesde: "2026-07-01" })], viaje).tipo).toBe("SIN_TARIFA");
    expect(seleccionarTarifa([t({ vigenciaHasta: "2026-06-14" })], viaje).tipo).toBe("SIN_TARIFA");
    expect(seleccionarTarifa([t({ vigenciaHasta: "2026-06-15" })], viaje).tipo).toBe("OK");
    expect(seleccionarTarifa([t({ clientId: "otro" })], viaje).tipo).toBe("SIN_TARIFA");
    expect(seleccionarTarifa([t({ activo: false })], viaje).tipo).toBe("SIN_TARIFA");
  });

  it("no elige silenciosamente entre dos tarifas del mismo nivel", () => {
    const r = seleccionarTarifa([t({}), t({ vigenciaDesde: "2026-06-01" })], viaje);
    expect(r.tipo).toBe("CONFLICTO");
  });

  it("detecta vigencias superpuestas con la misma clave", () => {
    const a = t({ vigenciaDesde: "2026-01-01", vigenciaHasta: "2026-06-30" });
    const b = t({ vigenciaDesde: "2026-06-30" });
    const c = t({ vigenciaDesde: "2026-07-01", cargoTypeId: "k1" });
    expect(detectarConflictos([a, b, c])).toEqual([[a, b]]);
    const d = t({ vigenciaDesde: "2026-07-01" });
    expect(detectarConflictos([a, d])).toEqual([]);
  });
});
