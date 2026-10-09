"use client";
import { useId } from "react";

interface BaseProps {
  etiqueta: string;
  error?: string | null;
  ayuda?: React.ReactNode;
  obligatorio?: boolean;
  className?: string;
}

export function Etiqueta({ htmlFor, children, obligatorio }: { htmlFor: string; children: React.ReactNode; obligatorio?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
      {children}
      {obligatorio && (
        <span className="text-red-700" aria-hidden>
          {" "}*
        </span>
      )}
    </label>
  );
}

export function MensajeCampo({ id, error, ayuda }: { id: string; error?: string | null; ayuda?: React.ReactNode }) {
  if (error)
    return (
      <p id={id} className="mt-1 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  if (ayuda)
    return (
      <p id={id} className="mt-1 text-xs text-slate-500">
        {ayuda}
      </p>
    );
  return null;
}

const claseInput =
  "block w-full rounded-lg border bg-white px-3 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-100 disabled:bg-slate-100 disabled:text-slate-500";

export function CampoTexto({
  etiqueta,
  error,
  ayuda,
  obligatorio,
  className = "",
  ...props
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const msg = `${id}-msg`;
  return (
    <div className={className}>
      <Etiqueta htmlFor={id} obligatorio={obligatorio}>
        {etiqueta}
      </Etiqueta>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error || ayuda ? msg : undefined}
        aria-required={obligatorio || undefined}
        className={`${claseInput} ${error ? "border-red-600" : "border-slate-300"}`}
        {...props}
      />
      <MensajeCampo id={msg} error={error} ayuda={ayuda} />
    </div>
  );
}

export function CampoAreaTexto({
  etiqueta,
  error,
  ayuda,
  obligatorio,
  className = "",
  ...props
}: BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const msg = `${id}-msg`;
  return (
    <div className={className}>
      <Etiqueta htmlFor={id} obligatorio={obligatorio}>
        {etiqueta}
      </Etiqueta>
      <textarea
        id={id}
        rows={3}
        aria-invalid={!!error || undefined}
        aria-describedby={error || ayuda ? msg : undefined}
        className={`${claseInput} ${error ? "border-red-600" : "border-slate-300"}`}
        {...props}
      />
      <MensajeCampo id={msg} error={error} ayuda={ayuda} />
    </div>
  );
}

export function CampoSelector({
  etiqueta,
  error,
  ayuda,
  obligatorio,
  className = "",
  opciones,
  vacio,
  ...props
}: BaseProps &
  React.SelectHTMLAttributes<HTMLSelectElement> & { opciones: Array<{ valor: string; etiqueta: string }>; vacio?: string }) {
  const id = useId();
  const msg = `${id}-msg`;
  return (
    <div className={className}>
      <Etiqueta htmlFor={id} obligatorio={obligatorio}>
        {etiqueta}
      </Etiqueta>
      <select
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error || ayuda ? msg : undefined}
        className={`${claseInput} ${error ? "border-red-600" : "border-slate-300"}`}
        {...props}
      >
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      <MensajeCampo id={msg} error={error} ayuda={ayuda} />
    </div>
  );
}

export function Casilla({ etiqueta, ayuda, ...props }: { etiqueta: string; ayuda?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-0.5 size-5 rounded border-slate-400 accent-marca-700" {...props} />
      <label htmlFor={id} className="text-sm text-slate-800">
        {etiqueta}
        {ayuda && <span className="block text-xs text-slate-500">{ayuda}</span>}
      </label>
    </div>
  );
}
