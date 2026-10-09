"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Estados";
import { api } from "@/lib/cliente/api";

function Formulario() {
  const token = useSearchParams().get("token") ?? "";
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (clave !== repetir) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    setError(null);
    try {
      await api("/api/auth/restablecer", { body: { token, claveNueva: clave } });
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!token) return <Aviso tipo="error">El enlace no es válido. Solicite uno nuevo al administrador.</Aviso>;
  if (ok)
    return (
      <div className="space-y-4">
        <Aviso tipo="exito">La contraseña se actualizó correctamente.</Aviso>
        <Link href="/login" className="block text-center font-semibold text-marca-700 underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  return (
    <form onSubmit={enviar} className="space-y-4">
      <h1 className="text-lg font-semibold">Definir nueva contraseña</h1>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <CampoTexto etiqueta="Nueva contraseña" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} ayuda="Mínimo 10 caracteres, con letras y números." obligatorio />
      <CampoTexto etiqueta="Repetir contraseña" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} obligatorio />
      <Boton type="submit" grande className="w-full" cargando={enviando} disabled={!clave || !repetir}>
        Guardar contraseña
      </Boton>
    </form>
  );
}

export default function PaginaRestablecer() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
