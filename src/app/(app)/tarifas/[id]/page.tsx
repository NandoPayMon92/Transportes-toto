"use client";
import { use, useState } from "react";
import Link from "next/link";
import { api, ErrorApi, useApi } from "@/lib/cliente/api";
import { FormularioTarifa, cuerpoTarifa, datosDesde } from "@/components/tarifas/FormularioTarifa";
import { TextoTarifa, alcance } from "@/components/tarifas/TextoTarifa";
import { Historial, type EntradaHistorial } from "@/components/viajes/Historial";
import { Dato, Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { Aviso, Cargando, ErrorCarga } from "@/components/ui/Estados";
import { Boton } from "@/components/ui/Boton";
import { Confirmar } from "@/components/ui/Dialogo";
import { CampoAreaTexto, CampoTexto } from "@/components/ui/Campo";
import { RequierePermiso, usePermiso } from "@/components/Sesion";
import { formatearFecha, sumarDias, hoyUruguay } from "@/lib/fechas";
import { MODALIDAD_ETIQUETA } from "@/lib/domain/tipos";
import { NIVEL_ETIQUETA } from "@/lib/domain/tarifas";
import type { TarifaDTO } from "@/server/servicios/tarifas";

interface Respuesta {
  tarifa: TarifaDTO;
  viajesAsociados: number;
  versiones: TarifaDTO[];
  historial: EntradaHistorial[];
}

function Contenido({ id }: { id: string }) {
  const gestionar = usePermiso("tarifas.gestionar");
  const { data, error, cargando, recargar } = useApi<Respuesta>(`/api/tarifas/${id}`);
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<{ mensaje: string; lista: string[] } | null>(null);
  const [vigencia, setVigencia] = useState(false);
  const [nv, setNv] = useState({ vigenciaDesde: hoyUruguay(), importe: "", motivo: "" });
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string; enlace?: string } | null>(null);

  if (cargando && !data) return <Cargando />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (!data) return null;
  const t = data.tarifa;

  if (editando)
    return (
      <div>
        <Encabezado titulo="Editar tarifa" acciones={<Boton variante="secundario" onClick={() => setEditando(false)}>Cancelar</Boton>} />
        <Tarjeta>
          <FormularioTarifa
            inicial={datosDesde(t)}
            edicion
            enviando={enviando}
            error={errorForm}
            onEnviar={async (d, motivo) => {
              setEnviando(true);
              setErrorForm(null);
              try {
                await api(`/api/tarifas/${t.id}`, { method: "PUT", body: { datos: cuerpoTarifa(d), version: t.version, motivo } });
                setEditando(false);
                setMensaje({ tipo: "exito", texto: "Tarifa actualizada." });
                await recargar();
              } catch (e) {
                setErrorForm({ mensaje: (e as ErrorApi).message, lista: (e as ErrorApi).lista });
              } finally {
                setEnviando(false);
              }
            }}
          />
        </Tarjeta>
      </div>
    );

  async function crearVigencia() {
    setEnviando(true);
    try {
      const nueva = await api<TarifaDTO>(`/api/tarifas/${t.id}/nueva-vigencia`, { body: nv });
      setVigencia(false);
      setMensaje({ tipo: "exito", texto: "Nueva vigencia creada.", enlace: `/tarifas/${nueva.id}` });
      await recargar();
    } catch (e) {
      setVigencia(false);
      setMensaje({ tipo: "error", texto: (e as ErrorApi).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Encabezado
        titulo={`Tarifa · ${t.cliente}`}
        descripcion={alcance(t)}
        acciones={
          gestionar && (
            <>
              <Boton variante="secundario" onClick={() => setEditando(true)}>Editar</Boton>
              {t.activo && (
                <Boton onClick={() => { const min = sumarDias(t.vigenciaDesde, 1); setNv({ vigenciaDesde: hoyUruguay() >= min ? hoyUruguay() : min, importe: t.importe, motivo: "" }); setVigencia(true); }}>
                  Nueva vigencia de precio
                </Boton>
              )}
            </>
          )
        }
      />
      {mensaje && (
        <Aviso tipo={mensaje.tipo}>
          {mensaje.texto} {mensaje.enlace && <Link className="font-semibold underline" href={mensaje.enlace}>Ver nueva tarifa</Link>}
        </Aviso>
      )}
      <Tarjeta>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Dato etiqueta="Modalidad">{MODALIDAD_ETIQUETA[t.modalidad]}</Dato>
          <Dato etiqueta="Tarifa"><TextoTarifa t={t} /></Dato>
          <Dato etiqueta="Prioridad">{t.nivel ? `${t.nivel} · ${NIVEL_ETIQUETA[t.nivel]}` : "—"}</Dato>
          <Dato etiqueta="Vigencia">{formatearFecha(t.vigenciaDesde)} → {t.vigenciaHasta ? formatearFecha(t.vigenciaHasta) : "sin fin"}</Dato>
          <Dato etiqueta="Estado">{t.activo ? "Activa" : "Inactiva"}</Dato>
          <Dato etiqueta="Viajes que la usan">{data.viajesAsociados}</Dato>
        </dl>
        {t.observaciones && <p className="mt-3 text-sm text-slate-700">{t.observaciones}</p>}
      </Tarjeta>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Historial de precios (misma combinación)">
          <ul className="divide-y divide-slate-100">
            {data.versiones.map((v) => (
              <li key={v.id} className={`py-2 text-sm ${v.id === t.id ? "font-semibold" : ""}`}>
                <Link href={`/tarifas/${v.id}`} className="flex justify-between gap-2 hover:underline">
                  <span>{formatearFecha(v.vigenciaDesde)} → {v.vigenciaHasta ? formatearFecha(v.vigenciaHasta) : "sin fin"}{!v.activo && " (inactiva)"}</span>
                  <TextoTarifa t={v} />
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Registro de cambios">
          <Historial entradas={data.historial} />
        </Tarjeta>
      </div>
      <Confirmar
        abierto={vigencia}
        titulo="Nueva vigencia de precio"
        mensaje={`La tarifa actual quedará vigente hasta el día anterior a la nueva fecha. Los viajes ya cerrados no cambian.`}
        textoConfirmar="Crear vigencia"
        cargando={enviando}
        deshabilitado={!nv.importe || nv.motivo.trim().length < 3}
        onCancelar={() => setVigencia(false)}
        onConfirmar={crearVigencia}
      >
        <CampoTexto etiqueta="Vigente desde" type="date" value={nv.vigenciaDesde} onChange={(e) => setNv((x) => ({ ...x, vigenciaDesde: e.target.value }))} obligatorio />
        <CampoTexto etiqueta="Nuevo importe" inputMode="decimal" value={nv.importe} onChange={(e) => setNv((x) => ({ ...x, importe: e.target.value }))} obligatorio />
        <CampoAreaTexto etiqueta="Motivo" value={nv.motivo} onChange={(e) => setNv((x) => ({ ...x, motivo: e.target.value }))} obligatorio />
      </Confirmar>
    </div>
  );
}

export default function PaginaTarifa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequierePermiso permiso="tarifas.ver">
      <Contenido id={id} />
    </RequierePermiso>
  );
}
