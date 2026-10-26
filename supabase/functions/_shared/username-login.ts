// Límite de intentos y latencia de login-with-username (U18, H2).
// Sin dependencias de Deno ni de npm: lo importan la función y `npm test`.

/**
 * Tiempo mínimo de toda respuesta de credenciales inválidas. El camino más
 * caro (usuario existente: getUserById y el bcrypt de /token) debe quedar por
 * debajo; así un usuario inexistente no responde antes que uno existente.
 */
export const FAILURE_FLOOR_MS = 1200;

/**
 * IP de quien llama a la función. La plataforma la pone en estas cabeceras;
 * cuál es fiable (y no la escribe el cliente) se comprueba en staging.
 */
export function clientIp(headers: Headers): string {
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/**
 * HMAC-SHA-256 de la IP en hexadecimal. La base nunca guarda la IP en claro, y
 * sin la clave no se puede recorrer el espacio de IPv4 para revertir el hash.
 */
export async function hashClientIp(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Espera lo que falte para que hayan pasado `floorMs` desde `startedAt`. En
 * bucle: un temporizador puede vencer una fracción de milisegundo antes.
 */
export async function waitForFloor(startedAt: number, floorMs = FAILURE_FLOOR_MS): Promise<void> {
  let remaining: number;
  while ((remaining = startedAt + floorMs - performance.now()) > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(remaining)));
  }
}
