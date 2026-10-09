import { leerJson, ruta } from "@/server/http";
import { actualizarUsuario, esquemaUsuario } from "@/server/servicios/usuarios";

export const PUT = ruta({ permiso: "usuarios.gestionar" }, async ({ req, actor, params }) =>
  actualizarUsuario(actor, params.id, await leerJson(req, esquemaUsuario)),
);
