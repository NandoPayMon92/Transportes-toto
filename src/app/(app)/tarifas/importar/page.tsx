"use client";
import { useState } from "react";
import Link from "next/link";
import { api, descargar, ErrorApi } from "@/lib/cliente/api";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Estados";
import { Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { RequierePermiso } from "@/components/Sesion";

interface Resultado {
  importadas: number;
  pendientesOmitidas: number[];
  catalogosCreados: string[];
}

function Contenido() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<{ mensaje: string; lista: string[] } | null>(null);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo || enviando) return;
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      setResultado(await api<Resultado>("/api/tarifas/importar", { body: fd }));
    } catch (err) {
      setError({ mensaje: (err as ErrorApi).message, lista: (err as ErrorApi).lista });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Encabezado titulo="Cargar tarifas desde Excel" descripcion="Para cargar las tarifas reales de los clientes de una sola vez." />
      <Tarjeta titulo="1. Descargar la plantilla">
        <p className="text-sm text-slate-700">
          La plantilla incluye una fila por cliente activo con el importe vacío (pendiente de configuración) y una hoja de instrucciones. Las filas sin importe se
          omiten: el sistema no inventa tarifas.
        </p>
        <Boton variante="secundario" className="mt-3" onClick={() => descargar("/api/tarifas/plantilla").catch((e) => setError({ mensaje: (e as Error).message, lista: [] }))}>
          Descargar plantilla .xlsx
        </Boton>
      </Tarjeta>
      <Tarjeta titulo="2. Subir la planilla completa">
        <form onSubmit={importar} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="archivo">
            Archivo .xlsx
          </label>
          <input
            id="archivo"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-marca-700 file:px-4 file:py-2 file:font-semibold file:text-white"
          />
          <Boton type="submit" grande cargando={enviando} disabled={!archivo}>
            Importar tarifas
          </Boton>
        </form>
      </Tarjeta>
      {error && <Aviso tipo="error" titulo={error.mensaje} lista={error.lista} />}
      {resultado && (
        <Aviso tipo="exito" titulo={`Se importaron ${resultado.importadas} tarifas.`}>
          {resultado.pendientesOmitidas.length > 0 && <p>Filas pendientes (sin importe) omitidas: {resultado.pendientesOmitidas.join(", ")}.</p>}
          {resultado.catalogosCreados.length > 0 && <p>Se crearon: {resultado.catalogosCreados.join("; ")}.</p>}
          <Link href="/tarifas" className="font-semibold underline">Ver tarifario</Link>
        </Aviso>
      )}
    </div>
  );
}

export default function PaginaImportar() {
  return (
    <RequierePermiso permiso="tarifas.gestionar">
      <Contenido />
    </RequierePermiso>
  );
}
