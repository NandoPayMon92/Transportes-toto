"use client";
import { useMemo } from "react";
import { useApi } from "./api";
import type { Opcion } from "@/components/ui/Combobox";

type Fila = { id: string; nombre?: string; matricula?: string; activo: boolean; esCarga?: boolean; esDescarga?: boolean };

/** Opciones de un catálogo para listas desplegables (incluye inactivos para mostrar valores ya asignados). */
export function useOpciones(catalogo: "clientes" | "choferes" | "vehiculos" | "cargas" | "lugares", uso?: "carga" | "descarga") {
  const { data, cargando, error } = useApi<Fila[]>(`/api/catalogos/${catalogo}?inactivos=true`);
  const opciones = useMemo<Opcion[]>(
    () =>
      (data ?? [])
        .filter((f) => !uso || (uso === "carga" ? f.esCarga : f.esDescarga))
        .map((f) => ({ valor: f.id, etiqueta: (f.matricula ?? f.nombre ?? "") as string, inactivo: !f.activo })),
    [data, uso],
  );
  return { opciones, cargando, error };
}
