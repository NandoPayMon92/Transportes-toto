"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { api, ErrorApi, qs, useApi } from "@/lib/cliente/api";
import { Boton } from "@/components/ui/Boton";
import { CampoAreaTexto, CampoTexto, Casilla } from "@/components/ui/Campo";
import { Dialogo, Confirmar } from "@/components/ui/Dialogo";
import { Aviso, Cargando, ErrorCarga, Vacio } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { RequierePermiso } from "@/components/Sesion";

type TipoCampo = "texto" | "area" | "casilla";
interface DefCampo {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  obligatorio?: boolean;
  enLista?: boolean;
  ayuda?: string;
}
interface DefCatalogo {
  titulo: string;
  singular: string;
  campoNombre: string;
  campos: DefCampo[];
  descripcion?: string;
}

const DEFINICIONES: Record<string, DefCatalogo> = {
  clientes: {
    titulo: "Clientes",
    singular: "cliente",
    campoNombre: "nombre",
    campos: [
      { clave: "nombre", etiqueta: "Nombre / razón social", tipo: "texto", obligatorio: true },
      { clave: "rut", etiqueta: "RUT", tipo: "texto", enLista: true },
      { clave: "observaciones", etiqueta: "Observaciones", tipo: "area" },
    ],
  },
  choferes: {
    titulo: "Choferes",
    singular: "chofer",
    campoNombre: "nombre",
    descripcion: "Sólo se registran los datos necesarios para la operación (no se guardan documentos personales).",
    campos: [
      { clave: "nombre", etiqueta: "Nombre", tipo: "texto", obligatorio: true },
      { clave: "telefono", etiqueta: "Teléfono (opcional)", tipo: "texto", enLista: true },
    ],
  },
  vehiculos: {
    titulo: "Matrículas",
    singular: "matrícula",
    campoNombre: "matricula",
    campos: [
      { clave: "matricula", etiqueta: "Matrícula", tipo: "texto", obligatorio: true, ayuda: "Se guarda en mayúsculas." },
      { clave: "descripcion", etiqueta: "Descripción", tipo: "texto", enLista: true },
    ],
  },
  cargas: {
    titulo: "Tipos de carga",
    singular: "tipo de carga",
    campoNombre: "nombre",
    campos: [{ clave: "nombre", etiqueta: "Nombre", tipo: "texto", obligatorio: true }],
  },
  lugares: {
    titulo: "Lugares de carga y descarga",
    singular: "lugar",
    campoNombre: "nombre",
    descripcion: "Un mismo lugar puede ser de carga, de descarga o ambos.",
    campos: [
      { clave: "nombre", etiqueta: "Nombre", tipo: "texto", obligatorio: true },
      { clave: "esCarga", etiqueta: "Lugar de carga", tipo: "casilla", enLista: true },
      { clave: "esDescarga", etiqueta: "Lugar de descarga", tipo: "casilla", enLista: true },
    ],
  },
};

type Fila = Record<string, unknown> & { id: string; activo: boolean };

function Contenido({ catalogo, def }: { catalogo: string; def: DefCatalogo }) {
  const [q, setQ] = useState("");
  const [inactivos, setInactivos] = useState(true);
  const { data, error, cargando, recargar } = useApi<Fila[]>(`/api/catalogos/${catalogo}${qs({ q, inactivos })}`);
  const [editando, setEditando] = useState<Fila | "nuevo" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [eliminar, setEliminar] = useState<Fila | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  function abrir(f: Fila | "nuevo") {
    setEditando(f);
    setErrorForm(null);
    const base: Record<string, unknown> = { activo: true };
    for (const c of def.campos) base[c.clave] = c.tipo === "casilla" ? true : "";
    setForm(f === "nuevo" ? base : { ...base, ...f });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErrorForm(null);
    const body: Record<string, unknown> = { activo: form.activo };
    for (const c of def.campos) body[c.clave] = form[c.clave] ?? (c.tipo === "casilla" ? false : null);
    try {
      if (editando === "nuevo") await api(`/api/catalogos/${catalogo}`, { body });
      else await api(`/api/catalogos/${catalogo}/${(editando as Fila).id}`, { method: "PUT", body });
      setEditando(null);
      setMensaje({ tipo: "exito", texto: "Guardado correctamente." });
      await recargar();
    } catch (err) {
      setErrorForm((err as ErrorApi).message);
    } finally {
      setEnviando(false);
    }
  }

  async function alternarActivo(f: Fila) {
    const body: Record<string, unknown> = { activo: !f.activo };
    for (const c of def.campos) body[c.clave] = f[c.clave] ?? null;
    try {
      await api(`/api/catalogos/${catalogo}/${f.id}`, { method: "PUT", body });
      await recargar();
    } catch (err) {
      setMensaje({ tipo: "error", texto: (err as ErrorApi).message });
    }
  }

  async function confirmarEliminar() {
    if (!eliminar) return;
    setEnviando(true);
    try {
      await api(`/api/catalogos/${catalogo}/${eliminar.id}`, { method: "DELETE" });
      setMensaje({ tipo: "exito", texto: "Registro eliminado." });
      await recargar();
    } catch (err) {
      setMensaje({ tipo: "error", texto: (err as ErrorApi).message });
    } finally {
      setEliminar(null);
      setEnviando(false);
    }
  }

  const camposLista = def.campos.filter((c) => c.enLista);
  return (
    <div className="space-y-4">
      <Encabezado titulo={def.titulo} descripcion={def.descripcion} acciones={<Boton onClick={() => abrir("nuevo")}>+ Agregar {def.singular}</Boton>} />
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      <Tarjeta>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <CampoTexto etiqueta="Buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          <Casilla etiqueta="Mostrar inactivos" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} />
        </div>
      </Tarjeta>
      {cargando && !data && <Cargando />}
      <ErrorCarga error={error} onReintentar={recargar} />
      {data && data.length === 0 && <Vacio titulo="No hay registros" />}
      {data && data.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {data.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`font-medium ${f.activo ? "" : "text-slate-500 line-through"}`}>{String(f[def.campoNombre])}</p>
                <p className="text-xs text-slate-600">
                  {camposLista
                    .map((c) => (c.tipo === "casilla" ? (f[c.clave] ? c.etiqueta : null) : f[c.clave] ? `${c.etiqueta}: ${f[c.clave]}` : null))
                    .filter(Boolean)
                    .join(" · ")}
                  {!f.activo && " · Inactivo"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" onClick={() => abrir(f)}>Editar</Boton>
                <Boton variante="secundario" onClick={() => alternarActivo(f)}>{f.activo ? "Desactivar" : "Activar"}</Boton>
                <Boton variante="fantasma" onClick={() => setEliminar(f)}>Eliminar</Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialogo abierto={editando !== null} titulo={editando === "nuevo" ? `Agregar ${def.singular}` : `Editar ${def.singular}`} onCerrar={() => setEditando(null)}>
        <form onSubmit={guardar} className="space-y-3">
          {errorForm && <Aviso tipo="error">{errorForm}</Aviso>}
          {def.campos.map((c) =>
            c.tipo === "casilla" ? (
              <Casilla key={c.clave} etiqueta={c.etiqueta} checked={!!form[c.clave]} onChange={(e) => setForm((x) => ({ ...x, [c.clave]: e.target.checked }))} />
            ) : c.tipo === "area" ? (
              <CampoAreaTexto key={c.clave} etiqueta={c.etiqueta} value={String(form[c.clave] ?? "")} onChange={(e) => setForm((x) => ({ ...x, [c.clave]: e.target.value }))} />
            ) : (
              <CampoTexto key={c.clave} etiqueta={c.etiqueta} obligatorio={c.obligatorio} ayuda={c.ayuda} value={String(form[c.clave] ?? "")} onChange={(e) => setForm((x) => ({ ...x, [c.clave]: e.target.value }))} />
            ),
          )}
          <Casilla etiqueta="Activo" checked={!!form.activo} onChange={(e) => setForm((x) => ({ ...x, activo: e.target.checked }))} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" grande onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" grande cargando={enviando}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
      <Confirmar
        abierto={!!eliminar}
        titulo={`¿Eliminar ${def.singular}?`}
        mensaje="Sólo puede eliminarse si no tiene viajes ni tarifas asociados. En ese caso, desactívelo para conservar el historial."
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={enviando}
        onCancelar={() => setEliminar(null)}
        onConfirmar={confirmarEliminar}
      />
    </div>
  );
}

export default function PaginaCatalogo({ params }: { params: Promise<{ catalogo: string }> }) {
  const { catalogo } = use(params);
  const def = DEFINICIONES[catalogo];
  if (!def) notFound();
  return (
    <RequierePermiso permiso="catalogos.gestionar">
      <Contenido key={catalogo} catalogo={catalogo} def={def} />
    </RequierePermiso>
  );
}
