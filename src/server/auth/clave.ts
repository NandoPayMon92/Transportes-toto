import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pwd: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

// Parámetros de scrypt (N=2^15, r=8, p=1) — recomendados por OWASP.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export async function hashClave(clave: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(clave, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarClave(clave: string, almacenado: string): Promise<boolean> {
  const partes = almacenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, "base64");
  const calculado = await scrypt(clave, Buffer.from(saltB64, "base64"), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Política mínima de contraseñas. Devuelve un mensaje de error o null. */
export function validarPoliticaClave(clave: string): string | null {
  if (clave.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (clave.length > 200) return "La contraseña es demasiado larga.";
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) return "La contraseña debe incluir letras y números.";
  return null;
}
