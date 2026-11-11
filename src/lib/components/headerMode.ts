/**
 * Variante del cabecero por ruta (U28, plan de dirección de arte §3).
 *
 * - completo: la barra de siempre.
 * - acceso (Entrar, tablero E): Sugerir va en contorno, porque la acción de la
 *   página es entrar.
 * - minimo (pasos del onboarding, tablero K): logo y Entrar en contorno; sin
 *   Sugerir ni panel.
 *
 * Hook para U30: una ruta declara su variante devolviendo `header` desde su
 * `load` (`return { header: 'minimo' }`). Lo declarado manda sobre la ruta, así
 * que los pasos nuevos del onboarding no tienen que tocar el cabecero.
 */
export type HeaderMode = 'completo' | 'acceso' | 'minimo';

const MODES: ReadonlySet<string> = new Set<HeaderMode>(['completo', 'acceso', 'minimo']);

const isMode = (value: unknown): value is HeaderMode => typeof value === 'string' && MODES.has(value);

export function headerModeFor(pathname: string, declared?: unknown): HeaderMode {
  if (isMode(declared)) return declared;
  if (pathname === '/auth/registro' || pathname.startsWith('/auth/registro/')) return 'minimo';
  if (pathname === '/auth/login') return 'acceso';
  return 'completo';
}
