"use client";
import { useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Estados";
import { api } from "@/lib/cliente/api";

export function FormCambioClave({ onListo }: { onListo?: () => void }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (nueva !== repetir) return setError("Las contraseñas nuevas no coinciden.");
    setEnviando(true);
    setError(null);
    try {
      await api("/api/auth/cambiar-clave", { body: { claveActual: actual, claveNueva: nueva } });
      setOk(true);
      setActual("");
      setNueva("");
      setRepetir("");
      onListo?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="exito">Contraseña actualizada.</Aviso>}
      <CampoTexto etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} obligatorio />
      <CampoTexto etiqueta="Nueva contraseña" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} ayuda="Mínimo 10 caracteres, con letras y números." obligatorio />
      <CampoTexto etiqueta="Repetir nueva contraseña" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} obligatorio />
      <Boton type="submit" grande className="w-full sm:w-auto" cargando={enviando} disabled={!actual || !nueva || !repetir}>
        Cambiar contraseña
      </Boton>
    </form>
  );
}
