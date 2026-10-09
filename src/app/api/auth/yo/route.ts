import { ruta } from "@/server/http";

export const GET = ruta({ permitirClaveVencida: true }, async ({ actor }) => ({ usuario: actor }));
