"use client";
import { FormularioViaje } from "@/components/viajes/FormularioViaje";
import { RequierePermiso } from "@/components/Sesion";
import { Encabezado } from "@/components/ui/Tarjeta";

export default function PaginaNuevoViaje() {
  return (
    <RequierePermiso permiso="viajes.crear">
      <Encabezado titulo="Nuevo viaje" descripcion="Complete los datos del viaje. La tarifa y el importe se calculan automáticamente." />
      <FormularioViaje />
    </RequierePermiso>
  );
}
