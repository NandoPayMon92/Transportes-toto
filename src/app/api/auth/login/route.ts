import { NextResponse } from "next/server";
import { leerJson, ruta } from "@/server/http";
import { esquemaLogin, iniciarSesion } from "@/server/servicios/auth";
import { COOKIE_SESION, opcionesCookie } from "@/server/auth/sesion";

export const POST = ruta({ publica: true }, async ({ req }) => {
  const { identificador, clave } = await leerJson(req, esquemaLogin);
  const s = await iniciarSesion(identificador, clave);
  const res = NextResponse.json({ ok: true, debeCambiarClave: s.debeCambiarClave });
  res.cookies.set(COOKIE_SESION, s.token, opcionesCookie(s.expiresAt));
  return res;
});
