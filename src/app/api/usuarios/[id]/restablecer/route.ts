import { ruta } from "@/server/http";
import { enlaceRestablecimiento } from "@/server/servicios/usuarios";

export const POST = ruta({ permiso: "usuarios.gestionar" }, async ({ actor, params }) => enlaceRestablecimiento(actor, params.id));
