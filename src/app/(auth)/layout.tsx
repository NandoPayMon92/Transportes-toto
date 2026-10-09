export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-marca-800 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold text-marca-700">Transportes Toto</p>
          <p className="text-sm text-slate-600">Gestión de viajes y facturación</p>
        </div>
        {children}
      </div>
    </main>
  );
}
