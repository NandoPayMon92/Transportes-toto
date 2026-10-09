"use client";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Boton } from "./Boton";

interface Props {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  acciones?: React.ReactNode;
}

export function Dialogo({ abierto, titulo, onCerrar, children, acciones }: Props) {
  return (
    <Dialog open={abierto} onClose={onCerrar} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/50" aria-hidden />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
          <DialogTitle className="text-lg font-semibold text-slate-900">{titulo}</DialogTitle>
          <div className="mt-3 text-sm text-slate-700">{children}</div>
          {acciones && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{acciones}</div>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

interface ConfirmarProps {
  abierto: boolean;
  titulo: string;
  mensaje: React.ReactNode;
  textoConfirmar: string;
  variante?: "primario" | "peligro" | "exito";
  cargando?: boolean;
  deshabilitado?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  children?: React.ReactNode;
}

/** Confirmación explícita para acciones irreversibles o sensibles (cerrar, facturar, anular). */
export function Confirmar({ abierto, titulo, mensaje, textoConfirmar, variante = "primario", cargando, deshabilitado, onConfirmar, onCancelar, children }: ConfirmarProps) {
  return (
    <Dialogo
      abierto={abierto}
      titulo={titulo}
      onCerrar={cargando ? () => {} : onCancelar}
      acciones={
        <>
          <Boton variante="secundario" grande onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton variante={variante} grande onClick={onConfirmar} cargando={cargando} disabled={deshabilitado}>
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      <div>{mensaje}</div>
      {children && <div className="mt-4 space-y-3">{children}</div>}
    </Dialogo>
  );
}
