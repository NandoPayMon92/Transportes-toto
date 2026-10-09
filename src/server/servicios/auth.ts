import { prisma } from "@/server/db";
import { hashClave, verificarClave, generarToken, hashToken, validarPoliticaClave } from "@/server/auth/clave";
import { crearSesion } from "@/server/auth/sesion";
import { ErrorValidacion, NoAutenticado } from "@/server/errores";
import { z } from "@/lib/validacion";

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const RESET_TTL_MIN = 60;

export const esquemaLogin = z.object({
  identificador: z.string().trim().min(1).max(120),
  clave: z.string().min(1).max(200),
});

// Hash ficticio para igualar tiempos de respuesta cuando el usuario no existe.
let hashFicticio: Promise<string> | null = null;

export async function iniciarSesion(identificador: string, clave: string) {
  const id = identificador.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ usuario: id }, { email: id }] },
  });
  const mensaje = "Usuario o contraseña incorrectos.";
  if (!user) {
    hashFicticio ??= hashClave("clave-ficticia-0");
    await verificarClave(clave, await hashFicticio);
    throw new NoAutenticado(mensaje);
  }
  if (!user.activo) throw new NoAutenticado(mensaje);
  if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
    throw new NoAutenticado("Demasiados intentos fallidos. Intente nuevamente en unos minutos.");
  }
  const ok = await verificarClave(clave, user.passwordHash);
  if (!ok) {
    const intentos = user.intentosFallidos + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        intentosFallidos: intentos >= MAX_INTENTOS ? 0 : intentos,
        bloqueadoHasta: intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MIN * 60_000) : null,
      },
    });
    throw new NoAutenticado(mensaje);
  }
  await prisma.user.update({ where: { id: user.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
  const sesion = await crearSesion(user.id);
  return { ...sesion, debeCambiarClave: user.debeCambiarClave };
}

export const esquemaCambioClave = z.object({
  claveActual: z.string().min(1).max(200),
  claveNueva: z.string().min(1).max(200),
});

export async function cambiarClave(userId: string, claveActual: string, claveNueva: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verificarClave(claveActual, user.passwordHash))) {
    throw new ErrorValidacion("La contraseña actual no es correcta.");
  }
  const err = validarPoliticaClave(claveNueva);
  if (err) throw new ErrorValidacion(err);
  if (claveActual === claveNueva) throw new ErrorValidacion("La nueva contraseña debe ser distinta de la actual.");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashClave(claveNueva), debeCambiarClave: false },
    }),
  ]);
}

/** Genera un enlace de restablecimiento de un solo uso (lo crea un administrador para entregarlo al usuario). */
export async function generarTokenRestablecimiento(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generarToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);
  await prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetToken.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export const esquemaRestablecer = z.object({
  token: z.string().min(10).max(200),
  claveNueva: z.string().min(1).max(200),
});

export async function restablecerClave(token: string, claveNueva: string) {
  const registro = await prisma.passwordResetToken.findUnique({ where: { id: hashToken(token) } });
  if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
    throw new ErrorValidacion("El enlace de restablecimiento no es válido o ya venció. Solicite uno nuevo al administrador.");
  }
  const err = validarPoliticaClave(claveNueva);
  if (err) throw new ErrorValidacion(err);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: registro.userId },
      data: { passwordHash: await hashClave(claveNueva), debeCambiarClave: false, intentosFallidos: 0, bloqueadoHasta: null },
    }),
    prisma.passwordResetToken.update({ where: { id: registro.id }, data: { usedAt: new Date() } }),
    // Cierra todas las sesiones abiertas del usuario.
    prisma.session.deleteMany({ where: { userId: registro.userId } }),
  ]);
}
