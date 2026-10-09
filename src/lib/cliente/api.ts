"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ErrorApi extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string,
    public detalles?: unknown,
  ) {
    super(message);
  }

  /** Lista de errores detallados (p. ej. condiciones de cierre no cumplidas). */
  get lista(): string[] {
    const d = this.detalles as { errores?: Array<string | { fila: number; mensaje: string }> } | Array<{ mensaje: string }> | undefined;
    if (Array.isArray(d)) return d.map((x) => x.mensaje);
    if (d && Array.isArray(d.errores)) return d.errores.map((e) => (typeof e === "string" ? e : `Fila ${e.fila}: ${e.mensaje}`));
    return [];
  }
}

export async function api<T = unknown>(url: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opciones.method ?? (opciones.body !== undefined ? "POST" : "GET"),
      headers: opciones.body !== undefined && !(opciones.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body: opciones.body === undefined ? undefined : opciones.body instanceof FormData ? opciones.body : JSON.stringify(opciones.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ErrorApi("No se pudo conectar con el servidor. Verifique su conexión.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/login")) {
      window.location.href = "/login";
    }
    throw new ErrorApi(data.error ?? "Error inesperado.", res.status, data.codigo, data.detalles);
  }
  return data as T;
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [cargando, setCargando] = useState(!!url);
  const ultimo = useRef(0);

  const recargar = useCallback(async () => {
    if (!url) return;
    const id = ++ultimo.current;
    setCargando(true);
    setError(null);
    try {
      const r = await api<T>(url);
      if (id === ultimo.current) setData(r);
    } catch (e) {
      if (id === ultimo.current) setError(e as ErrorApi);
    } finally {
      if (id === ultimo.current) setCargando(false);
    }
  }, [url]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { data, error, cargando, recargar, setData };
}

/** Descarga un archivo (Excel) respetando la sesión y mostrando errores en español. */
export async function descargar(url: string): Promise<void> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ErrorApi(data.error ?? "No se pudo generar el archivo.", res.status);
  }
  const blob = await res.blob();
  const nombre = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "export.xlsx";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "" && v !== false) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
