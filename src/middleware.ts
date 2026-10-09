import { NextResponse, type NextRequest } from "next/server";

// Redirección rápida al login si no hay cookie. La validación real de la sesión se hace en el servidor.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("toto_sesion")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|login|restablecer|favicon.ico|icon.svg).*)"],
};
