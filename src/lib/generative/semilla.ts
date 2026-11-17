/**
 * Semilla y azar deterministas del motor generativo (U27, plan de dirección de
 * arte §4). El mismo nombre da siempre la misma secuencia.
 */

/** Normaliza un nombre antes de sembrar: sin espacios en los bordes, NFC y en minúsculas. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().normalize('NFC').toLowerCase();
}

/** FNV-1a de 32 bits sobre las unidades UTF-16 del texto. Entero sin signo. */
export function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Semilla de un nombre normalizado. */
export const semillaDe = (nombre: string): number => fnv1a(normalizarNombre(nombre));

/**
 * PRNG determinista (mulberry32, el mismo del tablero A2). Devuelve números en
 * [0, 1).
 */
export function prng(semilla: number): () => number {
  let s = semilla | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

