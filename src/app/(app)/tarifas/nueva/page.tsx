"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ErrorApi, useApi } from "@/lib/cliente/api";
import { FormularioTarifa, cuerpoTarifa, datosDesde } from "@/components/tarifas/FormularioTarifa";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { Cargando } from "@/components/ui/Estados";
import { RequierePermiso } from "@/components/Sesion";
import type { ConfiguracionCalculo } from "@/lib/domain/tipos";
import type { TarifaDTO } from "@/server/servicios/tarifas";

function Contenido() {
  const router = useRouter();
  const clientId = useSearchParams().get("clientId");
  const { data: config } = useApi<ConfiguracionCalculo>("/api/configuracion");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; lista: string[] } | null>(null);
  if (!config) return <Cargando />;
  return (
    <Tarjeta>
      <FormularioTarifa
        inicial={datosDesde(undefined, clientId, config.baseCalculoPredeterminada)}
        enviando={enviando}
        error={error}
        onEnviar={async (d) => {
          setEnviando(true);
          setError(null);
          try {
            const t = await api<TarifaDTO>("/api/tarifas", { body: cuerpoTarifa(d) });
            router.push(`/tarifas/${t.id}`);
          } catch (e) {
            setError({ mensaje: (e as ErrorApi).message, lista: (e as ErrorApi).lista });
            setEnviando(false);
          }
        }}
      />
    </Tarjeta>
  );
}

export default function PaginaNuevaTarifa() {
  return (
    <RequierePermiso permiso="tarifas.gestionar">
      <Encabezado titulo="Nueva tarifa" />
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </RequierePermiso>
  );
}
