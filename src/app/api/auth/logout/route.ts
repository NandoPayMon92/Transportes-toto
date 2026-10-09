import { NextResponse } from "next/server";
import { ruta } from "@/server/http";
import { COOKIE_SESION, eliminarSesion } from "@/server/auth/sesion";

export const POST = ruta({ publica: true }, async ({ req }) => {
  await eliminarSesion(req.cookies.get(COOKIE_SESION)?.value);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESION, "", { path: "/", expires: new Date(0), httpOnly: true, sameSite: "lax" });
  return res;
});
