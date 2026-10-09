-- Restricciones de integridad que Prisma no expresa en el esquema.
ALTER TABLE "Tariff"
  ADD CONSTRAINT "tariff_importe_no_negativo" CHECK ("importe" >= 0),
  ADD CONSTRAINT "tariff_vigencia_valida" CHECK ("vigenciaHasta" IS NULL OR "vigenciaHasta" >= "vigenciaDesde"),
  ADD CONSTRAINT "tariff_por_peso_completa" CHECK ("modalidad" <> 'POR_PESO' OR ("unidad" IS NOT NULL AND "baseCalculo" IS NOT NULL)),
  ADD CONSTRAINT "tariff_moneda_formato" CHECK ("moneda" ~ '^[A-Z]{3}$');

ALTER TABLE "Trip"
  ADD CONSTRAINT "trip_kg_salida_no_negativo" CHECK ("kgSalida" IS NULL OR "kgSalida" >= 0),
  ADD CONSTRAINT "trip_kg_llegada_no_negativo" CHECK ("kgLlegada" IS NULL OR "kgLlegada" >= 0),
  ADD CONSTRAINT "trip_importe_no_negativo" CHECK ("importeFacturado" IS NULL OR "importeFacturado" >= 0),
  ADD CONSTRAINT "trip_cerrado_con_tarifa" CHECK ("estado" NOT IN ('CERRADO', 'FACTURADO') OR ("importeFacturado" IS NOT NULL AND "tarifaModalidad" IS NOT NULL)),
  ADD CONSTRAINT "trip_moneda_formato" CHECK ("moneda" ~ '^[A-Z]{3}$');
