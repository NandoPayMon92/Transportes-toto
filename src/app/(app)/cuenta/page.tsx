"use client";
import { FormCambioClave } from "@/components/FormCambioClave";
import { useSesion } from "@/components/Sesion";
import { Encabezado, Tarjeta, Dato } from "@/components/ui/Tarjeta";
import { ROL_ETIQUETA } from "@/lib/domain/tipos";

export default function PaginaCuenta() {
  const actor = useSesion();
  return (
    <div className="space-y-4">
      <Encabezado titulo="Mi cuenta" />
      <Tarjeta titulo="Datos">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Dato etiqueta="Nombre">{actor.nombre}</Dato>
          <Dato etiqueta="Usuario">{actor.usuario}</Dato>
          <Dato etiqueta="Rol">{ROL_ETIQUETA[actor.rol]}</Dato>
        </dl>
      </Tarjeta>
      <Tarjeta titulo="Cambiar contraseña">
        <div className="max-w-md">
          <FormCambioClave />
        </div>
      </Tarjeta>
    </div>
  );
}
