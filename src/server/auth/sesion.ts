import { prisma } from "@/server/db";
import { generarToken, hashToken } from "./clave";
import type { Actor } from "@/lib/permisos";
import type { Rol } from "@/lib/domain/tipos";

export const COOKIE_SESION = "toto_sesion";

export function ttlSesionMs(): number {
  const horas = Number(process.env.SESSION_TTL_HOURS ?? "12");
  return (Number.isFinite(horas) && horas > 0 ? horas : 12) * 3600 * 1000;
}

export async function crearSesion(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generarToken();
  const expiresAt = new Date(Date.now() + ttlSesionMs());
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  // Limpieza oportunista de sesiones vencidas.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { token, expiresAt };
}

export interface ActorSesion extends Actor {
  debeCambiarClave: boolean;
}

export async function actorDesdeToken(token: string | undefined | null): Promise<ActorSesion | null> {
  if (!token) return null;
  const sesion = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { role: true } } },
  });
  if (!sesion || sesion.expiresAt < new Date() || !sesion.user.activo) return null;
  const u = sesion.user;
  return {
    id: u.id,
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.role.codigo as Rol,
    puedeExportar: u.puedeExportar,
    debeCambiarClave: u.debeCambiarClave,
  };
}

export async function eliminarSesion(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}

export function opcionesCookie(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  };
}
