"use client";
import { useEffect, useState } from "react";
import { api, ErrorApi, useApi } from "@/lib/cliente/api";
import { Boton } from "@/components/ui/Boton";
import { CampoSelector, CampoTexto, Casilla } from "@/components/ui/Campo";
import { Aviso, Cargando } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { RequierePermiso } from "@/components/Sesion";
import { BASES, BASE_ETIQUETA, type ConfiguracionCalculo } from "@/lib/domain/tipos";

function Contenido() {
  const { data } = useApi<ConfiguracionCalculo>("/api/configuracion");
  const [c, setC] = useState<ConfiguracionCalculo | null>(null);
  const [umbral, setUmbral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  useEffect(() => {
    if (data) {
      setC(data);
      setUmbral(String(data.umbralDiferenciaPct).replace(".", ","));
    }
  }, [data]);
  if (!c) return <Cargando />;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api("/api/configuracion", { method: "PUT", body: { ...c, umbralDiferenciaPct: umbral.replace(",", ".") } });
      setMensaje({ tipo: "exito", texto: "Configuración guardada. Se aplica a los viajes que se guarden o cierren a partir de ahora." });
    } catch (err) {
      setMensaje({ tipo: "error", texto: (err as ErrorApi).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <Encabezado titulo="Configuración de cálculo" descripcion="Reglas que se aplican al registrar y cerrar viajes." />
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      <Tarjeta titulo="Diferencias de peso">
        <div className="max-w-md space-y-4">
          <CampoTexto etiqueta="Umbral de alerta (%)" inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)} ayuda="Se alerta cuando |salida − llegada| / salida supera este porcentaje." />
          <Casilla etiqueta="Exigir observación para cerrar viajes con alerta" checked={c.observacionObligatoriaPorDiferencia} onChange={(e) => setC({ ...c, observacionObligatoriaPorDiferencia: e.target.checked })} />
          <Casilla etiqueta="Impedir cerrar viajes con alerta" ayuda="Desactivado por defecto: la alerta no bloquea." checked={c.bloquearPorDiferencia} onChange={(e) => setC({ ...c, bloquearPorDiferencia: e.target.checked })} />
        </div>
      </Tarjeta>
      <Tarjeta titulo="Pesos y tarifas">
        <div className="max-w-md space-y-4">
          <Casilla
            etiqueta="Exigir kg de salida y de llegada para cerrar"
            ayuda="Si está desactivado, sólo se exigen los kg que necesita la base de cálculo de la tarifa."
            checked={c.exigirAmbosPesos}
            onChange={(e) => setC({ ...c, exigirAmbosPesos: e.target.checked })}
          />
          <CampoSelector
            etiqueta="Base de cálculo sugerida para tarifas nuevas"
            value={c.baseCalculoPredeterminada}
            onChange={(e) => setC({ ...c, baseCalculoPredeterminada: e.target.value as ConfiguracionCalculo["baseCalculoPredeterminada"] })}
            opciones={BASES.map((b) => ({ valor: b, etiqueta: BASE_ETIQUETA[b] }))}
          />
        </div>
      </Tarjeta>
      <Boton type="submit" grande cargando={enviando}>Guardar configuración</Boton>
    </form>
  );
}

export default function PaginaConfiguracion() {
  return (
    <RequierePermiso permiso="configuracion.gestionar">
      <Contenido />
    </RequierePermiso>
  );
}
