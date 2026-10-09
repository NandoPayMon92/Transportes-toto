import { z } from "zod";
import { esFechaISO } from "./fechas";
import { isDecimalString, normalizeDecimalInput } from "./domain/decimal";

// Mensajes de validación en español para todos los esquemas.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Este dato es obligatorio." };
      return { message: "Tipo de dato inválido." };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") return { message: issue.minimum === 1 ? "Este dato es obligatorio." : `Debe tener al menos ${issue.minimum} caracteres.` };
      return { message: `Debe ser mayor o igual a ${issue.minimum}.` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Debe tener como máximo ${issue.maximum} caracteres.` };
      return { message: `Debe ser menor o igual a ${issue.maximum}.` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Valor no permitido." };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Correo electrónico inválido." };
      return { message: "Formato inválido." };
    default:
      return { message: ctx.defaultError };
  }
});

export { z };

export const zFecha = z.string().refine(esFechaISO, { message: "Fecha inválida (formato AAAA-MM-DD)." });

export const zId = z.string().min(1).max(64);

export const zIdOpcional = z
  .string()
  .max(64)
  .nullish()
  .transform((v) => (v ? v : null));

export const zTextoOpcional = (max = 500) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : null;
    });

/** Número decimal no negativo como string (acepta coma decimal). Vacío => null. */
export const zDecimalOpcional = (maxDecimales = 2) =>
  z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === "") return null;
      const s = typeof v === "number" ? String(v) : normalizeDecimalInput(v);
      if (!isDecimalString(s)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe ser un número válido." });
        return z.NEVER;
      }
      if (s.startsWith("-")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "No puede ser negativo." });
        return z.NEVER;
      }
      const dec = s.split(".")[1]?.length ?? 0;
      if (dec > maxDecimales) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Admite como máximo ${maxDecimales} decimales.` });
        return z.NEVER;
      }
      if (Number(s) > 9_999_999_999) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El valor es demasiado grande." });
        return z.NEVER;
      }
      return s;
    });

export const zDecimal = (maxDecimales = 2) =>
  zDecimalOpcional(maxDecimales).refine((v): v is string => v !== null, { message: "Este dato es obligatorio." });

export const zEnteroOpcional = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe ser un número entero entre 0 y 1000." });
      return z.NEVER;
    }
    return n;
  });
