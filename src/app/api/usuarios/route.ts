import { leerJson, ruta } from "@/server/http";
import { crearUsuario, esquemaAltaUsuario, listarUsuarios } from "@/server/servicios/usuarios";

export const GET = ruta({ permiso: "usuarios.gestionar" }, async ({ actor }) => listarUsuarios(actor));
export const POST = ruta({ permiso: "usuarios.gestionar" }, async ({ req, actor }) =>
  crearUsuario(actor, await leerJson(req, esquemaAltaUsuario)),
);
