/**
 * Geometría del ordenable (U6), sin DOM: el componente mide y esta lógica
 * decide el destino y los desplazamientos. Tiene prueba propia.
 *
 * Las posiciones son las "naturales" (sin transformaciones), relativas a la
 * lista y medidas al empezar a arrastrar.
 */
export type SortableLayout = 'list' | 'grid';

export type Slot = { x: number; y: number; w: number; h: number };

/** Copia de `items` con el elemento `from` movido a `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from === to || from < 0 || from >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

/** Índices en el orden de vista previa: `from` insertado en `to`. */
export function previewOrder(count: number, from: number, to: number): number[] {
  return moveItem(Array.from({ length: count }, (_, index) => index), from, to);
}

/**
 * Destino del elemento arrastrado según su centro actual.
 * - list: cuántos de los demás tienen su centro por encima;
 * - grid: la casilla cuyo centro está más cerca.
 */
export function targetIndex(layout: SortableLayout, slots: readonly Slot[], from: number, center: { x: number; y: number }): number {
  if (layout === 'list') {
    let before = 0;
    slots.forEach((slot, index) => {
      if (index !== from && slot.y + slot.h / 2 < center.y) before += 1;
    });
    return before;
  }
  let best = from;
  let bestDistance = Number.POSITIVE_INFINITY;
  slots.forEach((slot, index) => {
    const distance = Math.hypot(slot.x + slot.w / 2 - center.x, slot.y + slot.h / 2 - center.y);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * Desplazamiento de cada elemento (por índice original) para mostrar el hueco
 * en `to`. El arrastrado vale {0,0}: lo mueve el puntero.
 * - list: se apilan las alturas reales con el espacio medido entre filas;
 * - grid: cada elemento ocupa la casilla de su nuevo índice (casillas iguales).
 */
export function previewOffsets(layout: SortableLayout, slots: readonly Slot[], from: number, to: number): { x: number; y: number }[] {
  const offsets = slots.map(() => ({ x: 0, y: 0 }));
  if (!slots.length || from === to) return offsets;
  const order = previewOrder(slots.length, from, to);

  if (layout === 'grid') {
    order.forEach((original, position) => {
      if (original === from) return;
      offsets[original] = { x: slots[position].x - slots[original].x, y: slots[position].y - slots[original].y };
    });
    return offsets;
  }

  const gap = slots.length > 1 ? Math.max(0, slots[1].y - (slots[0].y + slots[0].h)) : 0;
  let cursor = slots[0].y;
  for (const original of order) {
    if (original !== from) offsets[original] = { x: 0, y: cursor - slots[original].y };
    cursor += slots[original].h + gap;
  }
  return offsets;
}

/** Destino de una tecla sobre el asa, o null si la tecla no reordena. */
export function keyboardTarget(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      return Math.max(0, index - 1);
    case 'ArrowDown':
    case 'ArrowRight':
      return Math.min(count - 1, index + 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Velocidad de auto-scroll (px por cuadro) según la distancia al borde. */
export function edgeScrollSpeed(pointer: number, start: number, end: number, edge: number, max = 18): number {
  if (pointer < start + edge) return -Math.ceil(max * Math.min(1, (start + edge - pointer) / edge));
  if (pointer > end - edge) return Math.ceil(max * Math.min(1, (pointer - (end - edge)) / edge));
  return 0;
}
