"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/Boton";
import { CampoTexto } from "@/components/ui/Campo";
import { Aviso } from "@/components/ui/Estados";
import { api } from "@/lib/cliente/api";

export default function PaginaLogin() {
  const router = useRouter();
  const [identificador, setIdentificador] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await api<{ debeCambiarClave: boolean }>("/api/auth/login", { body: { identificador, clave } });
      router.replace(r.debeCambiarClave ? "/cambiar-clave" : "/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold">Iniciar sesión</h1>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <CampoTexto etiqueta="Usuario o correo" name="usuario" autoComplete="username" autoCapitalize="none" value={identificador} onChange={(e) => setIdentificador(e.target.value)} required obligatorio />
      <CampoTexto etiqueta="Contraseña" name="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required obligatorio />
      <Boton type="submit" grande className="w-full" cargando={enviando} disabled={!identificador || !clave}>
        Ingresar
      </Boton>
      <button type="button" className="w-full text-center text-sm text-marca-700 underline" onClick={() => setAyuda((a) => !a)} aria-expanded={ayuda}>
        ¿Olvidó su contraseña?
      </button>
      {ayuda && (
        <Aviso tipo="info">
          Por seguridad, la contraseña se restablece mediante un enlace de un solo uso que genera un administrador desde la sección
          Usuarios. Solicíteselo y ábralo en este dispositivo: tendrá validez por 60 minutos.
        </Aviso>
      )}
    </form>
  );
}
