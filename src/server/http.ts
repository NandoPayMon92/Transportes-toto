import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, ErrorValidacion, NoAutenticado, Prohibido } from "./errores";
import { actorDesdeToken, COOKIE_SESION, type ActorSesion } from "./auth/sesion";
import { tienePermiso, type Permiso } from "@/lib/permisos";

type Contexto = { params: Promise<Record<string, string>> };

interface OpcionesRuta {
  /** Permite el acceso sin sesión (login, restablecer clave). */
  publica?: boolean;
  /** Permiso requerido además de estar autenticado. */
  permiso?: Permiso;
  /** Permite usarla aunque el usuario deba cambiar la clave. */
  permitirClaveVencida?: boolean;
}

export interface Peticion {
  req: NextRequest;
  actor: ActorSesion;
  params: Record<string, string>;
}

/** Traduce errores conocidos a respuestas JSON en español sin filtrar detalles internos. */
export function respuestaError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message, codigo: err.codigo, detalles: err.detalles }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const detalles = err.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message }));
    return NextResponse.json(
      { error: detalles[0]?.mensaje ?? "Datos inválidos.", codigo: "VALIDACION", detalles },
      { status: 422 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un registro con ese valor.", codigo: "DUPLICADO" }, { status: 409 });
    }
    if (err.code === "P2025") {
      return NextResponse.json({ error: "El registro solicitado no existe.", codigo: "NO_ENCONTRADO" }, { status: 404 });
    }
    if (err.code === "P2003") {
      return NextResponse.json({ error: "El registro está en uso y no puede eliminarse.", codigo: "EN_USO" }, { status: 409 });
    }
  }
  // Sólo se registra el tipo y mensaje, nunca el cuerpo de la petición.
  console.error("Error no controlado:", err instanceof Error ? `${err.name}: ${err.message}` : "desconocido");
  return NextResponse.json({ error: "Ocurrió un error inesperado. Intente nuevamente.", codigo: "ERROR_INTERNO" }, { status: 500 });
}

/** Protección CSRF: las mutaciones deben venir del mismo origen. */
function verificarOrigen(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // clientes no navegador (pruebas, scripts); la cookie SameSite=Lax ya protege
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new Prohibido("Origen de la solicitud no permitido.");
  } catch (e) {
    if (e instanceof Prohibido) throw e;
    throw new Prohibido("Origen de la solicitud no permitido.");
  }
}

export function ruta(
  opciones: OpcionesRuta,
  fn: (p: Peticion) => Promise<unknown>,
): (req: NextRequest, ctx: Contexto) => Promise<Response> {
  return async (req, ctx) => {
    try {
      verificarOrigen(req);
      const params = (await ctx?.params) ?? {};
      const actor = await actorDesdeToken(req.cookies.get(COOKIE_SESION)?.value);
      if (!opciones.publica) {
        if (!actor) throw new NoAutenticado();
        if (actor.debeCambiarClave && !opciones.permitirClaveVencida) {
          throw new Prohibido("Debe cambiar su contraseña antes de continuar.");
        }
        if (opciones.permiso && !tienePermiso(actor, opciones.permiso)) throw new Prohibido();
      }
      const resultado = await fn({ req, actor: actor as ActorSesion, params });
      if (resultado instanceof Response) return resultado;
      return NextResponse.json(resultado ?? { ok: true });
    } catch (err) {
      return respuestaError(err);
    }
  };
}

export async function leerJson<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ErrorValidacion("El cuerpo de la solicitud no es JSON válido.");
  }
  return schema.parse(body);
}

export function parametros(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}
