"use client";
import { useState } from "react";
import { api, ErrorApi, useApi } from "@/lib/cliente/api";
import { Boton } from "@/components/ui/Boton";
import { CampoSelector, CampoTexto, Casilla } from "@/components/ui/Campo";
import { Dialogo } from "@/components/ui/Dialogo";
import { Aviso, Cargando, ErrorCarga } from "@/components/ui/Estados";
import { Encabezado } from "@/components/ui/Tarjeta";
import { RequierePermiso } from "@/components/Sesion";
import { ROLES, ROL_ETIQUETA, type Rol } from "@/lib/domain/tipos";

interface Usuario {
  id: string;
  usuario: string;
  email: string | null;
  nombre: string;
  rol: Rol;
  activo: boolean;
  puedeExportar: boolean;
  debeCambiarClave: boolean;
}

const vacio = { usuario: "", email: "", nombre: "", rol: "LOGISTICA" as Rol, puedeExportar: false, activo: true, clave: "" };

function Contenido() {
  const { data, error, cargando, recargar } = useApi<Usuario[]>("/api/usuarios");
  const [editando, setEditando] = useState<Usuario | "nuevo" | null>(null);
  const [form, setForm] = useState(vacio);
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<{ usuario: string; enlace: string } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  function abrir(u: Usuario | "nuevo") {
    setEditando(u);
    setErrorForm(null);
    setForm(u === "nuevo" ? vacio : { ...vacio, ...u, email: u.email ?? "" });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrorForm(null);
    try {
      if (editando === "nuevo") await api("/api/usuarios", { body: form });
      else {
        const { clave: _c, ...resto } = form;
        void _c;
        await api(`/api/usuarios/${(editando as Usuario).id}`, { method: "PUT", body: resto });
      }
      setEditando(null);
      setMensaje(editando === "nuevo" ? "Usuario creado. Deberá cambiar la contraseña en su primer ingreso." : "Usuario actualizado.");
      await recargar();
    } catch (err) {
      setErrorForm((err as ErrorApi).message);
    } finally {
      setEnviando(false);
    }
  }

  async function generarEnlace(u: Usuario) {
    try {
      const r = await api<{ enlace: string }>(`/api/usuarios/${u.id}/restablecer`, { method: "POST", body: {} });
      setEnlace({ usuario: u.nombre, enlace: r.enlace.startsWith("http") ? r.enlace : `${window.location.origin}${r.enlace}` });
    } catch (err) {
      setMensaje((err as ErrorApi).message);
    }
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo="Usuarios" acciones={<Boton onClick={() => abrir("nuevo")}>+ Nuevo usuario</Boton>} />
      {mensaje && <Aviso tipo="info">{mensaje}</Aviso>}
      {cargando && !data && <Cargando />}
      <ErrorCarga error={error} onReintentar={recargar} />
      {data && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`font-medium ${u.activo ? "" : "text-slate-500 line-through"}`}>{u.nombre}</p>
                <p className="text-xs text-slate-600">
                  {u.usuario}
                  {u.email ? ` · ${u.email}` : ""} · {ROL_ETIQUETA[u.rol]}
                  {u.rol === "LOGISTICA" && u.puedeExportar ? " · puede exportar" : ""}
                  {u.debeCambiarClave ? " · debe cambiar contraseña" : ""}
                  {!u.activo ? " · inactivo" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" onClick={() => abrir(u)}>Editar</Boton>
                <Boton variante="secundario" onClick={() => generarEnlace(u)}>Enlace para restablecer contraseña</Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialogo abierto={editando !== null} titulo={editando === "nuevo" ? "Nuevo usuario" : "Editar usuario"} onCerrar={() => setEditando(null)}>
        <form onSubmit={guardar} className="space-y-3">
          {errorForm && <Aviso tipo="error">{errorForm}</Aviso>}
          <CampoTexto etiqueta="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} obligatorio />
          <CampoTexto etiqueta="Usuario" autoCapitalize="none" value={form.usuario} onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))} obligatorio ayuda="Minúsculas, números, punto o guion." />
          <CampoTexto etiqueta="Correo (opcional)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <CampoSelector etiqueta="Rol" value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))} opciones={ROLES.map((r) => ({ valor: r, etiqueta: ROL_ETIQUETA[r] }))} />
          {form.rol === "LOGISTICA" && <Casilla etiqueta="Puede exportar a Excel" checked={form.puedeExportar} onChange={(e) => setForm((f) => ({ ...f, puedeExportar: e.target.checked }))} />}
          <Casilla etiqueta="Activo" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />
          {editando === "nuevo" && (
            <CampoTexto etiqueta="Contraseña inicial" type="password" autoComplete="new-password" value={form.clave} onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value }))} obligatorio ayuda="Mínimo 10 caracteres con letras y números. El usuario deberá cambiarla al ingresar." />
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" grande onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" grande cargando={enviando}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
      <Dialogo abierto={!!enlace} titulo="Enlace de restablecimiento" onCerrar={() => setEnlace(null)} acciones={<Boton grande onClick={() => setEnlace(null)}>Listo</Boton>}>
        <p>
          Entregue este enlace a <strong>{enlace?.usuario}</strong> por un canal seguro. Es de un solo uso y vence en 60 minutos.
        </p>
        <input readOnly value={enlace?.enlace ?? ""} onFocus={(e) => e.target.select()} className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs" aria-label="Enlace" />
        <Boton variante="secundario" className="mt-2" onClick={() => navigator.clipboard?.writeText(enlace?.enlace ?? "")}>Copiar</Boton>
      </Dialogo>
    </div>
  );
}

export default function PaginaUsuarios() {
  return (
    <RequierePermiso permiso="usuarios.gestionar">
      <Contenido />
    </RequierePermiso>
  );
}
