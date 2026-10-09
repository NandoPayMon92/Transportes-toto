import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { Conflicto, NoEncontrado } from "@/server/errores";
import { exigir } from "./autorizacion";
import type { Actor } from "@/lib/permisos";
import { z, zTextoOpcional } from "@/lib/validacion";

const activo = z.boolean().default(true);

export const CATALOGOS = {
  clientes: {
    modelo: "client",
    campoNombre: "nombre",
    etiqueta: "cliente",
    esquema: z.object({
      nombre: z.string().trim().min(1).max(120),
      rut: zTextoOpcional(20),
      observaciones: zTextoOpcional(500),
      activo,
    }),
  },
  choferes: {
    modelo: "driver",
    campoNombre: "nombre",
    etiqueta: "chofer",
    esquema: z.object({
      nombre: z.string().trim().min(1).max(120),
      telefono: zTextoOpcional(30),
      activo,
    }),
  },
  vehiculos: {
    modelo: "vehicle",
    campoNombre: "matricula",
    etiqueta: "matrícula",
    esquema: z.object({
      matricula: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9 -]{3,12}$/, "La matrícula debe tener entre 3 y 12 letras o números."),
      descripcion: zTextoOpcional(120),
      activo,
    }),
  },
  cargas: {
    modelo: "cargoType",
    campoNombre: "nombre",
    etiqueta: "tipo de carga",
    esquema: z.object({ nombre: z.string().trim().min(1).max(120), activo }),
  },
  lugares: {
    modelo: "location",
    campoNombre: "nombre",
    etiqueta: "lugar",
    esquema: z
      .object({
        nombre: z.string().trim().min(1).max(120),
        esCarga: z.boolean().default(true),
        esDescarga: z.boolean().default(true),
        activo,
      })
      .refine((v) => v.esCarga || v.esDescarga, { message: "El lugar debe ser de carga, de descarga o ambos.", path: ["esCarga"] }),
  },
} as const;

export type NombreCatalogo = keyof typeof CATALOGOS;

export function esCatalogo(n: string): n is NombreCatalogo {
  return Object.prototype.hasOwnProperty.call(CATALOGOS, n);
}

type Registro = Record<string, unknown> & { id: string };
interface Delegado {
  findMany(args: unknown): Promise<Registro[]>;
  findUnique(args: unknown): Promise<Registro | null>;
  findFirst(args: unknown): Promise<Registro | null>;
  create(args: unknown): Promise<Registro>;
  update(args: unknown): Promise<Registro>;
  delete(args: unknown): Promise<Registro>;
}

function delegado(n: NombreCatalogo): Delegado {
  return (prisma as unknown as Record<string, Delegado>)[CATALOGOS[n].modelo];
}

function serializar(r: Registro) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

export interface FiltroCatalogo {
  q?: string;
  incluirInactivos?: boolean;
  /** Para lugares: "carga" | "descarga" */
  uso?: string;
}

export async function listarCatalogo(_actor: Actor, n: NombreCatalogo, f: FiltroCatalogo = {}) {
  const campo = CATALOGOS[n].campoNombre;
  const where: Record<string, unknown> = {};
  if (!f.incluirInactivos) where.activo = true;
  if (f.q) where[campo] = { contains: f.q, mode: "insensitive" };
  if (n === "lugares" && f.uso === "carga") where.esCarga = true;
  if (n === "lugares" && f.uso === "descarga") where.esDescarga = true;
  const filas = await delegado(n).findMany({ where, orderBy: { [campo]: "asc" }, take: 1000 });
  return filas.map(serializar);
}

async function verificarDuplicado(n: NombreCatalogo, valor: string, excluirId?: string) {
  const campo = CATALOGOS[n].campoNombre;
  const existe = await delegado(n).findFirst({
    where: { [campo]: { equals: valor, mode: "insensitive" }, ...(excluirId ? { NOT: { id: excluirId } } : {}) },
  });
  if (existe) throw new Conflicto(`Ya existe un ${CATALOGOS[n].etiqueta} llamado "${valor}".`);
}

export async function crearEnCatalogo(actor: Actor, n: NombreCatalogo, input: unknown) {
  exigir(actor, "catalogos.gestionar");
  const data = CATALOGOS[n].esquema.parse(input) as Record<string, unknown>;
  await verificarDuplicado(n, String(data[CATALOGOS[n].campoNombre]));
  return serializar(await delegado(n).create({ data }));
}

export async function actualizarEnCatalogo(actor: Actor, n: NombreCatalogo, id: string, input: unknown) {
  exigir(actor, "catalogos.gestionar");
  const data = CATALOGOS[n].esquema.parse(input) as Record<string, unknown>;
  const actual = await delegado(n).findUnique({ where: { id } });
  if (!actual) throw new NoEncontrado();
  await verificarDuplicado(n, String(data[CATALOGOS[n].campoNombre]), id);
  return serializar(await delegado(n).update({ where: { id }, data }));
}

/** Elimina físicamente sólo si no tiene viajes ni tarifas asociados; si no, debe desactivarse. */
export async function eliminarDeCatalogo(actor: Actor, n: NombreCatalogo, id: string) {
  exigir(actor, "catalogos.gestionar");
  try {
    await delegado(n).delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new Conflicto(`El ${CATALOGOS[n].etiqueta} tiene viajes o tarifas asociados. Desactívelo en lugar de eliminarlo.`);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new NoEncontrado();
    throw e;
  }
}
