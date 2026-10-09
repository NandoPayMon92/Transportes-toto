import { redirect } from "next/navigation";
import { usuarioActual } from "@/server/auth/actual";
import { ProveedorSesion } from "@/components/Sesion";
import { Marco } from "@/components/Marco";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const actor = await usuarioActual();
  if (!actor) redirect("/login");
  if (actor.debeCambiarClave) redirect("/cambiar-clave");
  const { debeCambiarClave: _omitido, ...publico } = actor;
  void _omitido;
  return (
    <ProveedorSesion actor={publico}>
      <Marco>{children}</Marco>
    </ProveedorSesion>
  );
}
