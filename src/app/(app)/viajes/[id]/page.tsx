"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ErrorApi, useApi } from "@/lib/cliente/api";
import { Aviso, Cargando, ErrorCarga, InsigniaAlerta, InsigniaEstado } from "@/components/ui/Estados";
import { Dato, Encabezado, Tarjeta } from "@/components/ui/Tarjeta";
import { Boton } from "@/components/ui/Boton";
import { Confirmar } from "@/components/ui/Dialogo";
import { CampoAreaTexto, CampoTexto } from "@/components/ui/Campo";
import { FormularioViaje } from "@/components/viajes/FormularioViaje";
import { Historial, type EntradaHistorial } from "@/components/viajes/Historial";
import { usePermiso } from "@/components/Sesion";
import { formatearFecha, formatearFechaHora, hoyUruguay } from "@/lib/fechas";
import { formatearImporte, formatearKg, formatearPct, formatearTarifa } from "@/lib/formato";
import { BASE_ETIQUETA, MODALIDAD_ETIQUETA, UNIDAD_ETIQUETA } from "@/lib/domain/tipos";
import type { ViajeDTO } from "@/server/servicios/viajes";

type Respuesta = { viaje: ViajeDTO; historial: EntradaHistorial[] };
type Modal = null | "cerrar" | "facturar" | "anular" | "reabrir";

export default function PaginaViaje({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const guardado = useSearchParams().get("guardado");
  const { data, error, cargando, recargar } = useApi<Respuesta>(`/api/viajes/${id}`);
  const puedeCrear = usePermiso("viajes.crear");
  const [editando, setEditando] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [motivo, setMotivo] = useState("");
  const [factura, setFactura] = useState({ numero: "", fecha: hoyUruguay() });
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<{ mensaje: string; lista: string[] } | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(guardado ? "Viaje guardado correctamente." : null);

  if (cargando && !data) return <Cargando />;
  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (!data) return null;
  const v = data.viaje;

  async function ejecutar(accion: Exclude<Modal, null>) {
    if (enviando) return;
    setEnviando(true);
    setErrorAccion(null);
    try {
      const body: Record<string, unknown> = { version: v.version };
      if (accion === "anular" || accion === "reabrir") body.motivo = motivo;
      if (accion === "facturar") Object.assign(body, { numeroFactura: factura.numero, fechaFactura: factura.fecha });
      await api(`/api/viajes/${v.id}/${accion}`, { body });
      setModal(null);
      setMotivo("");
      setMensaje(
        { cerrar: "Viaje cerrado.", facturar: "Viaje marcado como facturado.", anular: "Viaje anulado.", reabrir: "Viaje reabierto." }[accion],
      );
      await recargar();
    } catch (e) {
      setErrorAccion({ mensaje: (e as ErrorApi).message, lista: (e as ErrorApi).lista });
      setModal(null);
    } finally {
      setEnviando(false);
    }
  }

  if (editando) {
    return (
      <div>
        <Encabezado titulo={`Editar viaje #${v.numero}`} acciones={<Boton variante="secundario" onClick={() => setEditando(false)}>Cancelar edición</Boton>} />
        <FormularioViaje
          viaje={v}
          onGuardado={async () => {
            setEditando(false);
            setMensaje("Cambios guardados.");
            await recargar();
          }}
        />
      </div>
    );
  }

  const a = v.acciones;
  return (
    <div className="space-y-4">
      <Encabezado
        titulo={`Viaje #${v.numero}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <InsigniaEstado estado={v.estado} />
            {v.alertaDiferencia && <InsigniaAlerta />}
            {!v.tarifaModalidad && v.estado !== "ANULADO" && <InsigniaAlerta texto="Sin tarifa" />}
            <span>{formatearFecha(v.fecha)}</span>
          </span>
        }
        acciones={
          <>
            {a.editar && <Boton variante="secundario" onClick={() => setEditando(true)}>Editar</Boton>}
            {a.cerrar && <Boton variante="exito" onClick={() => setModal("cerrar")}>Cerrar viaje</Boton>}
            {a.facturar && <Boton onClick={() => setModal("facturar")}>Marcar facturado</Boton>}
            {a.reabrir && <Boton variante="secundario" onClick={() => setModal("reabrir")}>Reabrir</Boton>}
            {a.anular && <Boton variante="peligro" onClick={() => setModal("anular")}>Anular</Boton>}
          </>
        }
      />
      {mensaje && (
        <Aviso tipo="exito">
          {mensaje}{" "}
          {puedeCrear && (
            <Link href="/viajes/nuevo" className="font-semibold underline">
              Cargar otro viaje
            </Link>
          )}
        </Aviso>
      )}
      {errorAccion && <Aviso tipo="error" titulo={errorAccion.mensaje} lista={errorAccion.lista} />}
      {v.estado === "ANULADO" && <Aviso tipo="error" titulo="Viaje anulado">Motivo: {v.motivoAnulacion}</Aviso>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Datos operativos" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dato etiqueta="Fecha">{formatearFecha(v.fecha)}</Dato>
            <Dato etiqueta="Matrícula">{v.matricula}</Dato>
            <Dato etiqueta="Cliente">{v.cliente}</Dato>
            <Dato etiqueta="Chofer">{v.chofer}</Dato>
            <Dato etiqueta="Carga">{v.carga}</Dato>
            <Dato etiqueta="Lugar de carga">{v.origen}</Dato>
            <Dato etiqueta="Lugar de descarga">{v.destino}</Dato>
            {v.numeroOrden && <Dato etiqueta="Nro. de orden">{v.numeroOrden}</Dato>}
            {v.numeroPesada && <Dato etiqueta="Nro. de pesada">{v.numeroPesada}</Dato>}
            {v.viaticos !== null && <Dato etiqueta="Viáticos">{v.viaticos}</Dato>}
            {v.estadias !== null && <Dato etiqueta="Estadías">{v.estadias}</Dato>}
          </dl>
          {v.observaciones && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Observaciones</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{v.observaciones}</p>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Facturación">
          <dl className="space-y-3">
            <Dato etiqueta="Importe facturado" destacado>{formatearImporte(v.importeFacturado, v.moneda)}</Dato>
            <Dato etiqueta="Modalidad">{v.tarifaModalidad ? MODALIDAD_ETIQUETA[v.tarifaModalidad] : "Sin tarifa"}</Dato>
            <Dato etiqueta="Tarifa aplicada">
              {v.tarifaImporte ? `${formatearTarifa(v.tarifaImporte, v.moneda)} ${v.tarifaModalidad === "POR_PESO" && v.tarifaUnidad ? UNIDAD_ETIQUETA[v.tarifaUnidad] : "por viaje"}` : "—"}
            </Dato>
            {v.tarifaBase && v.tarifaModalidad === "POR_PESO" && <Dato etiqueta="Base de cálculo">{BASE_ETIQUETA[v.tarifaBase]}</Dato>}
            {v.tarifaVigenciaDesde && <Dato etiqueta="Vigencia de la tarifa">desde {formatearFecha(v.tarifaVigenciaDesde)}</Dato>}
            {v.liquidacionCliente && (
              <Dato etiqueta="Liquidación del cliente">
                {formatearImporte(v.liquidacionCliente, v.moneda)}
                {v.importeFacturado && (
                  <span className="block text-xs text-slate-600">
                    Diferencia: {formatearImporte((Number(v.liquidacionCliente) - Number(v.importeFacturado)).toFixed(2), v.moneda)}
                  </span>
                )}
              </Dato>
            )}
            {v.numeroFactura && <Dato etiqueta="Factura">{v.numeroFactura} {v.fechaFactura && `(${formatearFecha(v.fechaFactura)})`}</Dato>}
          </dl>
          {v.tarifaSnapshot != null && <p className="mt-3 text-xs text-slate-500">Tarifa congelada al cerrar: los cambios posteriores del tarifario no afectan este viaje.</p>}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Cálculos de peso">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Dato etiqueta="Kg salida">{formatearKg(v.kgSalida)}</Dato>
          <Dato etiqueta="Kg llegada">{formatearKg(v.kgLlegada)}</Dato>
          <Dato etiqueta="Promedio">{formatearKg(v.kgPromedio)}</Dato>
          <Dato etiqueta="Diferencia">{formatearKg(v.kgDiferencia)}</Dato>
          <Dato etiqueta="% diferencia">{formatearPct(v.porcentajeDiferencia)}</Dato>
          <Dato etiqueta="Kg facturados">{formatearKg(v.kgBase)}</Dato>
        </dl>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Responsables">
          <dl className="space-y-3 text-sm">
            <Dato etiqueta="Creado">{v.creadoPor} · {formatearFechaHora(v.creadoEn)}</Dato>
            <Dato etiqueta="Última modificación">{v.modificadoPor} · {formatearFechaHora(v.modificadoEn)}</Dato>
            {v.cerradoPor && <Dato etiqueta="Cerrado">{v.cerradoPor} · {formatearFechaHora(v.cerradoEn)}</Dato>}
          </dl>
        </Tarjeta>
        <Tarjeta titulo="Historial de cambios" className="lg:col-span-2">
          <Historial entradas={data.historial} />
        </Tarjeta>
      </div>

      <Confirmar
        abierto={modal === "cerrar"}
        titulo="¿Cerrar el viaje?"
        mensaje="Se recalculará el importe con la tarifa vigente y quedará congelada. Después sólo un administrador podrá modificarlo."
        textoConfirmar="Cerrar viaje"
        variante="exito"
        cargando={enviando}
        onCancelar={() => setModal(null)}
        onConfirmar={() => ejecutar("cerrar")}
      />
      <Confirmar
        abierto={modal === "facturar"}
        titulo="¿Marcar como facturado?"
        mensaje={`Importe: ${formatearImporte(v.importeFacturado, v.moneda)}.`}
        textoConfirmar="Marcar facturado"
        cargando={enviando}
        onCancelar={() => setModal(null)}
        onConfirmar={() => ejecutar("facturar")}
      >
        <CampoTexto etiqueta="Nro. de factura (opcional)" value={factura.numero} onChange={(e) => setFactura((f) => ({ ...f, numero: e.target.value }))} maxLength={50} />
        <CampoTexto etiqueta="Fecha de factura" type="date" value={factura.fecha} onChange={(e) => setFactura((f) => ({ ...f, fecha: e.target.value }))} />
      </Confirmar>
      <Confirmar
        abierto={modal === "anular" || modal === "reabrir"}
        titulo={modal === "anular" ? "¿Anular el viaje?" : "¿Reabrir el viaje?"}
        mensaje={modal === "anular" ? "El viaje dejará de contar en informes y facturación. Esta acción queda registrada." : "El viaje volverá a estado abierto y podrá editarse. Al cerrarlo nuevamente se aplicará la tarifa vigente en ese momento."}
        textoConfirmar={modal === "anular" ? "Anular viaje" : "Reabrir"}
        variante={modal === "anular" ? "peligro" : "primario"}
        cargando={enviando}
        deshabilitado={motivo.trim().length < 3}
        onCancelar={() => setModal(null)}
        onConfirmar={() => ejecutar(modal as "anular" | "reabrir")}
      >
        <CampoAreaTexto etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} obligatorio maxLength={500} />
      </Confirmar>
    </div>
  );
}
