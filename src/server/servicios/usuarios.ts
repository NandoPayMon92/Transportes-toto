import { prisma } from "@/server/db";
import { hashClave, validarPoliticaClave } from "@/server/auth/clave";
import { Conflicto, ErrorValidacion, NoEncontrado } from "@/server/errores";
import { exigir } from "./autorizacion";
import type { Actor } from "@/lib/permisos";
import { ROLES, type Rol } from "@/lib/domain/tipos";
import { z } from "@/lib/validacion";
import { generarTokenRestablecimiento } from "./auth";

const usuarioRe = /^[a-z0-9._-]{3,40}$/;

export const esquemaUsuario = z.object({
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(usuarioRe, "El usuario debe tener entre 3 y 40 caracteres: letras minúsculas, números, punto, guion o guion bajo."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(120)
    .nullish()
    .or(z.literal("").transform(() => null)),
  nombre: z.string().trim().min(1).max(120),
  rol: z.enum(ROLES),
  puedeExportar: z.boolean().default(false),
  activo: z.boolean().default(true),
});

export const esquemaAltaUsuario = esquemaUsuario.extend({ clave: z.string().min(1).max(200) });

function dto(u: { id: string; usuario: string; email: string | null; nombre: string; activo: boolean; puedeExportar: boolean; debeCambiarClave: boolean; createdAt: Date; role: { codigo: string } }) {
  return {
    id: u.id,
    usuario: u.usuario,
    email: u.email,
    nombre: u.nombre,
    rol: u.role.codigo as Rol,
    activo: u.activo,
    puedeExportar: u.puedeExportar,
    debeCambiarClave: u.debeCambiarClave,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listarUsuarios(actor: Actor) {
  exigir(actor, "usuarios.gestionar");
  const users = await prisma.user.findMany({ include: { role: true }, orderBy: { nombre: "asc" } });
  return users.map(dto);
}

async function rolId(codigo: Rol) {
  const r = await prisma.role.findUnique({ where: { codigo } });
  if (!r) throw new ErrorValidacion("Rol inexistente.");
  return r.id;
}

export async function crearUsuario(actor: Actor, input: z.infer<typeof esquemaAltaUsuario>) {
  exigir(actor, "usuarios.gestionar");
  const err = validarPoliticaClave(input.clave);
  if (err) throw new ErrorValidacion(err);
  const existe = await prisma.user.findFirst({
    where: { OR: [{ usuario: input.usuario }, ...(input.email ? [{ email: input.email }] : [])] },
  });
  if (existe) throw new Conflicto("Ya existe un usuario con ese nombre de usuario o correo.");
  const u = await prisma.user.create({
    data: {
      usuario: input.usuario,
      email: input.email ?? null,
      nombre: input.nombre,
      roleId: await rolId(input.rol),
      puedeExportar: input.puedeExportar,
      activo: input.activo,
      passwordHash: await hashClave(input.clave),
      // La clave inicial la define el administrador: el usuario debe cambiarla al ingresar.
      debeCambiarClave: true,
    },
    include: { role: true },
  });
  return dto(u);
}

export async function actualizarUsuario(actor: Actor, id: string, input: z.infer<typeof esquemaUsuario>) {
  exigir(actor, "usuarios.gestionar");
  const actual = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!actual) throw new NoEncontrado("Usuario inexistente.");
  if (id === actor.id && (input.rol !== "ADMIN" || !input.activo)) {
    throw new ErrorValidacion("No puede quitarse a sí mismo el rol de administrador ni desactivarse.");
  }
  const u = await prisma.user.update({
    where: { id },
    data: {
      usuario: input.usuario,
      email: input.email ?? null,
      nombre: input.nombre,
      roleId: await rolId(input.rol),
      puedeExportar: input.puedeExportar,
      activo: input.activo,
    },
    include: { role: true },
  });
  if (!input.activo) await prisma.session.deleteMany({ where: { userId: id } });
  return dto(u);
}

export async function enlaceRestablecimiento(actor: Actor, id: string) {
  exigir(actor, "usuarios.gestionar");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new NoEncontrado("Usuario inexistente.");
  const { token, expiresAt } = await generarTokenRestablecimiento(id);
  const base = process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? "";
  return { enlace: `${base}/restablecer?token=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() };
}

