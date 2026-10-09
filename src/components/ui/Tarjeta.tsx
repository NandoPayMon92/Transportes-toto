export function Tarjeta({ titulo, children, acciones, className = "" }: { titulo?: React.ReactNode; children: React.ReactNode; acciones?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(titulo || acciones) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>}
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: React.ReactNode; acciones?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-600">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function Dato({ etiqueta, children, destacado }: { etiqueta: string; children: React.ReactNode; destacado?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className={`mt-0.5 tabular ${destacado ? "text-lg font-bold text-slate-900" : "text-slate-900"}`}>{children ?? "—"}</dd>
    </div>
  );
}
