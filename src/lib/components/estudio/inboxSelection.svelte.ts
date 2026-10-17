import { tick } from 'svelte';
import { afterNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { BELOW_MOBILE_QUERY } from '$lib/ui/breakpoints';
import { withParams } from '$lib/domain/studio';

/**
 * Qué elemento abre la bandeja del Estudio (U17) y cómo se mueve el foco. El
 * elemento vive en la URL (`?propuesta=` o `?reporte=`), así que se puede
 * enlazar y "atrás" funciona.
 *
 * - En ancho (768 o más), lista y detalle conviven: elegir reemplaza la entrada
 *   del historial y el foco se queda en la lista.
 * - En móvil, elegir abre el detalle en una entrada nueva y lleva el foco a su
 *   título; "Volver" regresa a la lista con el foco en el elemento que se abrió.
 *
 * Se crea durante la inicialización del componente (usa `$effect` y `afterNavigate`).
 */
export class InboxSelection {
  /** 768 px o más: lista y detalle a la vez. */
  wide = $state(typeof window === 'undefined' || !window.matchMedia(BELOW_MOBILE_QUERY).matches);
  /** El título del detalle (InboxDetail `bind:heading`). */
  heading = $state<HTMLHeadingElement | undefined>();

  #param: string;
  #pushed = false;
  #focus: { kind: 'heading' } | { kind: 'item'; id: string } | null = null;

  constructor(param: string) {
    this.#param = param;

    $effect(() => {
      const query = window.matchMedia(BELOW_MOBILE_QUERY);
      const update = () => (this.wide = !query.matches);
      update();
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    });

    afterNavigate(() => {
      const target = this.#focus;
      this.#focus = null;
      if (target) void this.#applyFocus(target);
    });
  }

  /** El id pedido en la URL, aunque ya no esté en la lista. */
  get requested(): string | null {
    return page.url.searchParams.get(this.#param);
  }

  /** Enlace a un elemento (o a la lista, con null), conservando el resto de la query. */
  href(id: string | null): string {
    return withParams(page.url, { [this.#param]: id });
  }

  /** Abre un elemento desde la lista. */
  select(id: string) {
    if (this.wide) {
      void goto(this.href(id), { replaceState: true, noScroll: true, keepFocus: true });
      return;
    }
    this.#pushed = true;
    this.#focus = { kind: 'heading' };
    void goto(this.href(id), { keepFocus: true });
  }

  /**
   * Fija en la URL el elemento abierto (si se abrió solo, por ser el primero),
   * para que siga abierto aunque cambie de lugar en la lista al actuar sobre él.
   */
  async pin(id: string) {
    if (this.requested === id) return;
    await goto(this.href(id), { replaceState: true, noScroll: true, keepFocus: true });
  }

  /** Móvil: vuelve del detalle de `id` a la lista. */
  back(id: string | null) {
    this.#focus = id ? { kind: 'item', id } : null;
    if (this.#pushed) {
      this.#pushed = false;
      history.back();
      return;
    }
    void goto(this.href(null), { replaceState: true, keepFocus: true });
  }

  /**
   * Tras resolver un elemento, que sale de la lista: en ancho se abre `next`
   * (con el foco en su título); en móvil se vuelve a la lista. En los dos, la
   * vista sube al principio, donde está el aviso con el resultado.
   */
  advance(next: string | null, params: Record<string, string | null> = {}) {
    this.#pushed = false;
    this.#focus = this.wide && next ? { kind: 'heading' } : null;
    // `params`: lo que cambia además del elemento (U19: el editor se cierra con editar=null).
    void goto(withParams(page.url, { [this.#param]: this.wide ? next : null, ...params }), { replaceState: true, keepFocus: true });
  }

  async #applyFocus(target: { kind: 'heading' } | { kind: 'item'; id: string }) {
    await tick();
    if (target.kind === 'heading') {
      // Sin desplazar: la vista ya está donde debe (arriba, con el aviso o el detalle).
      this.heading?.focus({ preventScroll: true });
      return;
    }
    const item = document.querySelector<HTMLElement>(`[data-inbox-item="${CSS.escape(target.id)}"]`);
    item?.focus();
  }
}
