"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectorBuscable } from "@/components/ui/Combobox";
import { CampoAreaTexto, CampoTexto, Casilla } from "@/components/ui/Campo";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Estados";
import { Confirmar } from "@/components/ui/Dialogo";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { ResumenCalculo } from "./ResumenCalculo";
import { usePermiso } from "@/components/Sesion";
import { api, ErrorApi, useApi } from "@/lib/cliente/api";
import { useOpciones } from "@/lib/cliente/catalogos";
import { calcularViaje } from "@/lib/domain/calculos";
import { isDecimalString, normalizeDecimalInput } from "@/lib/domain/decimal";
import { hoyUruguay } from "@/lib/fechas";
import { formatearImporte } from "@/lib/formato";
import type { ConfiguracionCalculo, TarifaCalculo } from "@/lib/domain/tipos";
import type { ViajeDTO } from "@/server/servicios/viajes";
import type { ResultadoResolucion } from "@/server/servicios/tarifas";

interface Datos {
  fecha: string;
  vehicleId: string | null;
  clientId: string | null;
  driverId: string | null;
  cargoTypeId: string | null;
  cargaDetalle: string;
  origenId: string | null;
  destinoId: string | null;
  kgSalida: string;
  kgLlegada: string;
  numeroOrden: string;
  numeroPesada: string;
  viaticos: string;
  estadias: string;
  liquidacionCliente: string;
  observaciones: string;
}

function inicial(v?: ViajeDTO): Datos {
  const coma = (s: string | null) => (s ? s.replace(".", ",") : "");
  return {
    fecha: v?.fecha ?? hoyUruguay(),
    vehicleId: v?.vehicleId ?? null,
    clientId: v?.clientId ?? null,
    driverId: v?.driverId ?? null,
    cargoTypeId: v?.cargoTypeId ?? null,
    cargaDetalle: v?.cargaDetalle ?? "",
    origenId: v?.origenId ?? null,
    destinoId: v?.destinoId ?? null,
    kgSalida: coma(v?.kgSalida ?? null),
    kgLlegada: coma(v?.kgLlegada ?? null),
    numeroOrden: v?.numeroOrden ?? "",
    numeroPesada: v?.numeroPesada ?? "",
    viaticos: v?.viaticos?.toString() ?? "",
    estadias: v?.estadias?.toString() ?? "",
    liquidacionCliente: coma(v?.liquidacionCliente ?? null),
    observaciones: v?.observaciones ?? "",
  };
}

function kgValido(s: string): string | null {
  if (!s.trim()) return null;
  const n = normalizeDecimalInput(s);
  return isDecimalString(n) ? n : "invalido";
}

type Accion = "BORRADOR" | "ABIERTO" | "CERRAR" | "GUARDAR";

export function FormularioViaje({ viaje, onGuardado }: { viaje?: ViajeDTO; onGuardado?: (v: ViajeDTO) => void }) {
  const router = useRouter();
  const editando = !!viaje;
  const cerrado = viaje?.estado === "CERRADO" || viaje?.estado === "FACTURADO";
  const puedeCerrar = usePermiso("viajes.cerrar");
  const [d, setD] = useState<Datos>(() => inicial(viaje));
  const [enviando, setEnviando] = useState<Accion | null>(null);
  const [error, setError] = useState<{ mensaje: string; lista: string[] } | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [masDatos, setMasDatos] = useState(!!(viaje?.numeroOrden || viaje?.numeroPesada || viaje?.viaticos || viaje?.estadias || viaje?.liquidacionCliente));
  const [motivo, setMotivo] = useState("");
  const [reaplicar, setReaplicar] = useState(false);
  // Clave única por formulario: un doble envío devuelve el mismo viaje en lugar de duplicarlo.
  const clave = useRef<string>("");
  if (!clave.current) clave.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  const vehiculos = useOpciones("vehiculos");
  const clientes = useOpciones("clientes");
  const choferes = useOpciones("choferes");
  const cargas = useOpciones("cargas");
  const origenes = useOpciones("lugares", "carga");
  const destinos = useOpciones("lugares", "descarga");
  const { data: recientes } = useApi<Record<string, string[]>>(editando ? null : "/api/viajes/recientes");
  const { data: config } = useApi<ConfiguracionCalculo>("/api/configuracion");
  const umbral = config?.umbralDiferenciaPct ?? 2;

  const set = <K extends keyof Datos>(k: K, v: Datos[K]) => setD((x) => ({ ...x, [k]: v }));

  // Búsqueda de la tarifa vigente en el servidor cuando cambian los datos que la determinan.
  const [resolucion, setResolucion] = useState<ResultadoResolucion | null>(null);
  const [buscando, setBuscando] = useState(false);
  const usarCongelada = cerrado && !reaplicar;
  useEffect(() => {
    if (usarCongelada || !d.clientId || !d.fecha) {
      setResolucion(null);
      return;
    }
    const id = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await api<{ resolucion: ResultadoResolucion }>("/api/viajes/previsualizar", {
          body: { fecha: d.fecha, clientId: d.clientId, origenId: d.origenId, destinoId: d.destinoId, cargoTypeId: d.cargoTypeId },
        });
        setResolucion(r.resolucion);
      } catch {
        setResolucion(null);
      } finally {
        setBuscando(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [d.clientId, d.fecha, d.origenId, d.destinoId, d.cargoTypeId, usarCongelada]);

  const tarifa = useMemo(() => {
    if (usarCongelada && viaje?.tarifaModalidad && viaje.tarifaImporte) {
      return {
        modalidad: viaje.tarifaModalidad,
        importe: viaje.tarifaImporte,
        unidad: viaje.tarifaUnidad,
        baseCalculo: viaje.tarifaBase,
        moneda: viaje.moneda,
        vigenciaDesde: viaje.tarifaVigenciaDesde,
        nivelEtiqueta: "Tarifa congelada al cerrar el viaje",
      };
    }
    if (resolucion?.tipo === "OK") return { ...resolucion.tarifa, nivelEtiqueta: resolucion.nivelEtiqueta };
    return null;
  }, [usarCongelada, viaje, resolucion]);

  const kgS = kgValido(d.kgSalida);
  const kgL = kgValido(d.kgLlegada);
  // Cálculo en tiempo real en el navegador (mismo código que usa el servidor).
  const calculo = useMemo(
    () =>
      calcularViaje(
        { kgSalida: kgS === "invalido" ? "x" : kgS, kgLlegada: kgL === "invalido" ? "x" : kgL, tarifa: tarifa as TarifaCalculo | null },
        { umbralDiferenciaPct: umbral },
      ),
    [kgS, kgL, tarifa, umbral],
  );

  const faltaObligatorio = (v: unknown) => (intentado && !v ? "Este dato es obligatorio." : null);
  const errorKg = (v: string | null) => (v === "invalido" ? "Ingrese un número válido (ej.: 28410 o 28410,5)." : null);

  function cuerpo() {
    return {
      fecha: d.fecha,
      vehicleId: d.vehicleId,
      clientId: d.clientId,
      driverId: d.driverId,
      cargoTypeId: d.cargoTypeId,
      cargaDetalle: d.cargaDetalle,
      origenId: d.origenId,
      destinoId: d.destinoId,
      kgSalida: d.kgSalida,
      kgLlegada: d.kgLlegada,
      numeroOrden: d.numeroOrden,
      numeroPesada: d.numeroPesada,
      viaticos: d.viaticos,
      estadias: d.estadias,
      liquidacionCliente: d.liquidacionCliente,
      observaciones: d.observaciones,
    };
  }

  async function guardar(accion: Accion) {
    if (enviando) return; // evita doble pulsación
    setIntentado(accion !== "BORRADOR");
    setError(null);
    setEnviando(accion);
    try {
      let r: { viaje: ViajeDTO; duplicado?: boolean };
      if (!editando) {
        r = await api("/api/viajes", { body: { datos: cuerpo(), accion, idempotencyKey: clave.current } });
      } else {
        r = await api(`/api/viajes/${viaje!.id}`, {
          method: "PUT",
          body: { datos: cuerpo(), version: viaje!.version, accion, motivo: motivo || null, reaplicarTarifa: reaplicar },
        });
      }
      setConfirmarCierre(false);
      if (onGuardado) onGuardado(r.viaje);
      else router.push(`/viajes/${r.viaje.id}?guardado=1`);
    } catch (e) {
      const err = e as ErrorApi;
      setError({ mensaje: err.message, lista: err.lista ?? [] });
      setConfirmarCierre(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setEnviando(null);
    }
  }

  const erroresCierreLocales = [
    ...(!d.vehicleId || !d.clientId || !d.driverId || !d.origenId || !d.destinoId || (!d.cargoTypeId && !d.cargaDetalle)
      ? ["Complete todos los datos obligatorios."]
      : []),
    ...(!tarifa ? [resolucion?.tipo === "CONFLICTO" ? resolucion.mensaje : "No hay una tarifa vigente para este viaje."] : []),
    ...calculo.problemas.filter((p) => !p.startsWith("No hay una tarifa")),
    ...(calculo.alertaDiferencia && config?.observacionObligatoriaPorDiferencia && !d.observaciones.trim()
      ? ["Agregue una observación que explique la diferencia de peso."]
      : []),
    ...(calculo.alertaDiferencia && config?.bloquearPorDiferencia ? ["La configuración impide cerrar viajes con diferencia de peso."] : []),
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar(editando ? "GUARDAR" : "ABIERTO");
      }}
      noValidate
      className="grid gap-4 lg:grid-cols-[1fr_340px]"
    >
      <div className="space-y-4">
        {error && <Aviso tipo="error" titulo={error.mensaje} lista={error.lista} />}
        {cerrado && (
          <Aviso tipo="advertencia" titulo="Está modificando un viaje cerrado">
            El cambio quedará registrado en el historial con su usuario y el motivo indicado.
          </Aviso>
        )}

        <Tarjeta titulo="Datos del viaje">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto etiqueta="Fecha" type="date" value={d.fecha} onChange={(e) => set("fecha", e.target.value)} obligatorio error={faltaObligatorio(d.fecha)} />
            <SelectorBuscable etiqueta="Matrícula" name="matricula" opciones={vehiculos.opciones} valor={d.vehicleId} onChange={(v) => set("vehicleId", v)} recientes={recientes?.vehicleId} obligatorio error={faltaObligatorio(d.vehicleId)} />
            <SelectorBuscable etiqueta="Cliente" name="cliente" opciones={clientes.opciones} valor={d.clientId} onChange={(v) => set("clientId", v)} recientes={recientes?.clientId} obligatorio error={faltaObligatorio(d.clientId)} />
            <SelectorBuscable etiqueta="Chofer" name="chofer" opciones={choferes.opciones} valor={d.driverId} onChange={(v) => set("driverId", v)} recientes={recientes?.driverId} obligatorio error={faltaObligatorio(d.driverId)} />
            <SelectorBuscable
              etiqueta="Carga"
              name="carga"
              opciones={cargas.opciones}
              valor={d.cargoTypeId}
              onChange={(v) => set("cargoTypeId", v)}
              recientes={recientes?.cargoTypeId}
              onTextoLibre={(t) => set("cargaDetalle", t)}
              textoLibreEtiqueta="Escribir como detalle:"
              obligatorio
              error={intentado && !d.cargoTypeId && !d.cargaDetalle ? "Seleccione o escriba la carga." : null}
              ayuda="Elija un tipo de carga o escriba un texto libre."
            />
            <CampoTexto etiqueta="Detalle de la carga (opcional)" name="cargaDetalle" value={d.cargaDetalle} onChange={(e) => set("cargaDetalle", e.target.value)} maxLength={200} placeholder="Ej.: Sal/C frescos" />
            <SelectorBuscable etiqueta="Lugar de carga" name="origen" opciones={origenes.opciones} valor={d.origenId} onChange={(v) => set("origenId", v)} recientes={recientes?.origenId} obligatorio error={faltaObligatorio(d.origenId)} />
            <SelectorBuscable etiqueta="Lugar de descarga" name="destino" opciones={destinos.opciones} valor={d.destinoId} onChange={(v) => set("destinoId", v)} recientes={recientes?.destinoId} obligatorio error={faltaObligatorio(d.destinoId)} />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Pesos">
          <div className="grid grid-cols-2 gap-4">
            <CampoTexto etiqueta="Kg de salida" name="kgSalida" inputMode="decimal" autoComplete="off" value={d.kgSalida} onChange={(e) => set("kgSalida", e.target.value)} error={errorKg(kgS)} placeholder="0" />
            <CampoTexto etiqueta="Kg de llegada" name="kgLlegada" inputMode="decimal" autoComplete="off" value={d.kgLlegada} onChange={(e) => set("kgLlegada", e.target.value)} error={errorKg(kgL)} placeholder="0" />
          </div>
          <CampoAreaTexto
            className="mt-4"
            etiqueta="Observaciones"
            name="observaciones"
            value={d.observaciones}
            onChange={(e) => set("observaciones", e.target.value)}
            maxLength={1000}
            error={intentado && calculo.alertaDiferencia && config?.observacionObligatoriaPorDiferencia && !d.observaciones.trim() ? "Explique la diferencia de peso." : null}
          />
          <button type="button" className="mt-3 text-sm font-semibold text-marca-700 underline" onClick={() => setMasDatos((m) => !m)} aria-expanded={masDatos}>
            {masDatos ? "Ocultar datos adicionales" : "Más datos (orden, pesada, viáticos…)"}
          </button>
          {masDatos && (
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <CampoTexto etiqueta="Nro. de orden" value={d.numeroOrden} onChange={(e) => set("numeroOrden", e.target.value)} maxLength={50} />
              <CampoTexto etiqueta="Nro. de pesada" value={d.numeroPesada} onChange={(e) => set("numeroPesada", e.target.value)} maxLength={50} />
              <CampoTexto etiqueta="Viáticos" inputMode="numeric" value={d.viaticos} onChange={(e) => set("viaticos", e.target.value)} />
              <CampoTexto etiqueta="Estadías" inputMode="numeric" value={d.estadias} onChange={(e) => set("estadias", e.target.value)} />
              <CampoTexto etiqueta="Liquidación del cliente" inputMode="decimal" value={d.liquidacionCliente} onChange={(e) => set("liquidacionCliente", e.target.value)} ayuda="Importe informado por el cliente, para control." />
            </div>
          )}
        </Tarjeta>

        {cerrado && (
          <Tarjeta titulo="Motivo de la modificación">
            <CampoAreaTexto etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} obligatorio maxLength={500} />
            <div className="mt-3">
              <Casilla
                etiqueta="Reaplicar la tarifa vigente"
                ayuda="Por defecto se mantiene la tarifa congelada al cerrar. Marque sólo si la tarifa original era incorrecta."
                checked={reaplicar}
                onChange={(e) => setReaplicar(e.target.checked)}
              />
            </div>
          </Tarjeta>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Tarjeta titulo="Tarifa y cálculo">
          <ResumenCalculo
            tarifa={tarifa}
            calculo={calculo}
            umbral={umbral}
            buscando={buscando}
            mensajeTarifa={resolucion && resolucion.tipo !== "OK" ? resolucion.mensaje : null}
            tipoMensaje={resolucion?.tipo === "CONFLICTO" ? "error" : "advertencia"}
          />
        </Tarjeta>

        <div className="flex flex-col gap-2">
          {!editando && (
            <>
              <Boton type="submit" grande cargando={enviando === "ABIERTO"} disabled={!!enviando}>
                Guardar viaje
              </Boton>
              {puedeCerrar && (
                <Boton variante="exito" grande disabled={!!enviando} onClick={() => { setIntentado(true); setConfirmarCierre(true); }}>
                  Guardar y cerrar
                </Boton>
              )}
              <Boton variante="secundario" grande cargando={enviando === "BORRADOR"} disabled={!!enviando} onClick={() => guardar("BORRADOR")}>
                Guardar como borrador
              </Boton>
            </>
          )}
          {editando && (
            <>
              <Boton type="submit" grande cargando={enviando === "GUARDAR"} disabled={!!enviando || (cerrado && motivo.trim().length < 3)}>
                Guardar cambios
              </Boton>
              {viaje?.estado === "BORRADOR" && (
                <Boton variante="secundario" grande cargando={enviando === "ABIERTO"} disabled={!!enviando} onClick={() => guardar("ABIERTO")}>
                  Guardar y pasar a abierto
                </Boton>
              )}
            </>
          )}
          <p className="text-xs text-slate-500">
            <span className="text-red-700">*</span> Obligatorio para guardar o cerrar. El borrador admite datos incompletos.
          </p>
        </div>
      </div>

      <Confirmar
        abierto={confirmarCierre}
        titulo="¿Cerrar el viaje?"
        textoConfirmar="Cerrar viaje"
        variante="exito"
        cargando={enviando === "CERRAR"}
        deshabilitado={erroresCierreLocales.length > 0}
        onCancelar={() => setConfirmarCierre(false)}
        onConfirmar={() => guardar("CERRAR")}
        mensaje={
          erroresCierreLocales.length ? (
            <Aviso tipo="error" titulo="Todavía no se puede cerrar" lista={erroresCierreLocales} />
          ) : (
            <p>
              Se guardará con un importe de <strong>{formatearImporte(calculo.importe, tarifa?.moneda ?? "UYU")}</strong> y la tarifa quedará congelada. Después
              sólo un administrador podrá modificarlo.
            </p>
          )
        }
      />
    </form>
  );
}
