"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useSesion, usePermiso } from "./Sesion";
import { api } from "@/lib/cliente/api";
import { ROL_ETIQUETA } from "@/lib/domain/tipos";
import type { Permiso } from "@/lib/permisos";

interface Item {
  href: string;
  texto: string;
  icono: string;
  permiso?: Permiso;
  principal?: boolean;
}

const ITEMS: Item[] = [
  { href: "/", texto: "Inicio", icono: "⌂", principal: true },
  { href: "/viajes/nuevo", texto: "Nuevo viaje", icono: "+", permiso: "viajes.crear", principal: true },
  { href: "/viajes", texto: "Viajes", icono: "☰", principal: true },
  { href: "/informes", texto: "Informes", icono: "▤", permiso: "informes.operativos", principal: true },
  { href: "/tarifas", texto: "Tarifario", icono: "$", permiso: "tarifas.ver" },
  { href: "/catalogos/clientes", texto: "Clientes", icono: "•", permiso: "catalogos.gestionar" },
  { href: "/catalogos/choferes", texto: "Choferes", icono: "•", permiso: "catalogos.gestionar" },
  { href: "/catalogos/vehiculos", texto: "Matrículas", icono: "•", permiso: "catalogos.gestionar" },
  { href: "/catalogos/cargas", texto: "Tipos de carga", icono: "•", permiso: "catalogos.gestionar" },
  { href: "/catalogos/lugares", texto: "Lugares", icono: "•", permiso: "catalogos.gestionar" },
  { href: "/usuarios", texto: "Usuarios", icono: "•", permiso: "usuarios.gestionar" },
  { href: "/configuracion", texto: "Configuración", icono: "⚙", permiso: "configuracion.gestionar" },
  { href: "/cuenta", texto: "Mi cuenta", icono: "◉" },
];

function useItemsVisibles() {
  const permisos = {
    "viajes.crear": usePermiso("viajes.crear"),
    "informes.operativos": usePermiso("informes.operativos"),
    "tarifas.ver": usePermiso("tarifas.ver"),
    "catalogos.gestionar": usePermiso("catalogos.gestionar"),
    "usuarios.gestionar": usePermiso("usuarios.gestionar"),
    "configuracion.gestionar": usePermiso("configuracion.gestionar"),
  } as Record<string, boolean>;
  return ITEMS.filter((i) => !i.permiso || permisos[i.permiso]);
}

function activo(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/viajes") return path === "/viajes" || (path.startsWith("/viajes/") && !path.startsWith("/viajes/nuevo"));
  return path.startsWith(href);
}

export function Marco({ children }: { children: React.ReactNode }) {
  const actor = useSesion();
  const path = usePathname();
  const router = useRouter();
  const items = useItemsVisibles();
  const [menu, setMenu] = useState(false);

  async function salir() {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh md:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Saltar al contenido
      </a>
      {/* Barra lateral en escritorio */}
      <aside className="hidden w-60 shrink-0 flex-col bg-marca-800 text-white md:flex">
        <div className="px-5 py-5">
          <p className="text-lg font-bold">Transportes Toto</p>
          <p className="text-xs text-marca-100">Viajes y facturación</p>
        </div>
        <nav aria-label="Navegación principal" className="flex-1 space-y-0.5 px-2">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={activo(path, i.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${activo(path, i.href) ? "bg-white/15 font-semibold" : "text-marca-100 hover:bg-white/10"}`}
            >
              <span aria-hidden className="w-4 text-center">{i.icono}</span>
              {i.texto}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-sm">
          <p className="font-medium">{actor.nombre}</p>
          <p className="text-xs text-marca-100">{ROL_ETIQUETA[actor.rol]}</p>
          <button onClick={salir} className="mt-2 text-xs underline">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior en móvil */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-marca-800 px-4 py-3 text-white md:hidden">
          <Link href="/" className="font-bold">
            Transportes Toto
          </Link>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-controls="menu-movil"
            className="rounded-lg px-3 py-1.5 text-sm ring-1 ring-white/30"
          >
            {menu ? "Cerrar" : "Menú"}
          </button>
        </header>
        {menu && (
          <nav id="menu-movil" aria-label="Menú" className="z-20 border-b border-slate-200 bg-white shadow md:hidden">
            <ul className="grid grid-cols-2 gap-1 p-2">
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                    {i.texto}
                  </Link>
                </li>
              ))}
              <li className="col-span-2 border-t border-slate-200 px-3 pt-2 text-xs text-slate-600">
                {actor.nombre} · {ROL_ETIQUETA[actor.rol]}
                <button onClick={salir} className="ml-3 font-semibold text-marca-700 underline">
                  Cerrar sesión
                </button>
              </li>
            </ul>
          </nav>
        )}

        <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-4 sm:px-6 md:pb-10">
          {children}
        </main>

        {/* Navegación inferior en móvil */}
        <nav aria-label="Accesos rápidos" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {items
            .filter((i) => i.principal)
            .slice(0, 4)
            .map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-current={activo(path, i.href) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center text-xs ${activo(path, i.href) ? "font-bold text-marca-700" : "text-slate-600"}`}
              >
                <span aria-hidden className={`text-lg leading-none ${i.href === "/viajes/nuevo" ? "flex size-8 items-center justify-center rounded-full bg-marca-700 text-white" : ""}`}>
                  {i.icono}
                </span>
                {i.texto}
              </Link>
            ))}
        </nav>
      </div>
    </div>
  );
}
