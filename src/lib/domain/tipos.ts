/** Tipos y etiquetas del dominio compartidos entre frontend y backend (sin dependencias de Prisma). */

export const ROLES = ["ADMIN", "LOGISTICA", "CONSULTA"] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_ETIQUETA: Record<Rol, string> = {
  ADMIN: "Administrador",
  LOGISTICA: "Logística",
  CONSULTA: "Consulta / administración",
};

export const MODALIDADES = ["FIJO", "POR_PESO"] as const;
export type Modalidad = (typeof MODALIDADES)[number];
export const MODALIDAD_ETIQUETA: Record<Modalidad, string> = {
  FIJO: "Importe fijo",
  POR_PESO: "Por kilogramos",
};

export const UNIDADES = ["KG", "TONELADA"] as const;
export type Unidad = (typeof UNIDADES)[number];
export const UNIDAD_ETIQUETA: Record<Unidad, string> = {
  KG: "por kilogramo",
  TONELADA: "por tonelada (1.000 kg)",
};

export const BASES = ["SALIDA", "LLEGADA", "PROMEDIO", "MAYOR", "MENOR", "PROMEDIO_DISPONIBLE"] as const;
export type Base = (typeof BASES)[number];
export const BASE_ETIQUETA: Record<Base, string> = {
  SALIDA: "Kg de salida",
  LLEGADA: "Kg de llegada",
  PROMEDIO: "Promedio de kg",
  MAYOR: "Mayor de ambas mediciones",
  MENOR: "Menor de ambas mediciones",
  PROMEDIO_DISPONIBLE: "Promedio (o la medición disponible si falta una)",
};

export const ESTADOS = ["BORRADOR", "ABIERTO", "CERRADO", "FACTURADO", "ANULADO"] as const;
export type Estado = (typeof ESTADOS)[number];
export const ESTADO_ETIQUETA: Record<Estado, string> = {
  BORRADOR: "Borrador",
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
  FACTURADO: "Facturado",
  ANULADO: "Anulado",
};

export const MONEDAS = ["UYU", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];
export const MONEDA_ETIQUETA: Record<string, string> = {
  UYU: "Pesos uruguayos ($)",
  USD: "Dólares (US$)",
};

export interface TarifaCalculo {
  modalidad: Modalidad;
  importe: string;
  unidad: Unidad | null;
  baseCalculo: Base | null;
  moneda: string;
}

export interface ConfiguracionCalculo {
  /** Porcentaje de diferencia de peso a partir del cual se alerta. */
  umbralDiferenciaPct: number;
  /** Si es true, se exige una observación para cerrar un viaje con alerta de diferencia. */
  observacionObligatoriaPorDiferencia: boolean;
  /** Si es true, no se permite cerrar viajes con alerta de diferencia. */
  bloquearPorDiferencia: boolean;
  /** Si es true, se exigen ambas mediciones (salida y llegada) para cerrar cualquier viaje. */
  exigirAmbosPesos: boolean;
  /** Base de cálculo que se sugiere al crear una tarifa por peso. */
  baseCalculoPredeterminada: Base;
}

export const CONFIGURACION_PREDETERMINADA: ConfiguracionCalculo = {
  umbralDiferenciaPct: 2,
  observacionObligatoriaPorDiferencia: true,
  bloquearPorDiferencia: false,
  exigirAmbosPesos: false,
  baseCalculoPredeterminada: "PROMEDIO",
};
