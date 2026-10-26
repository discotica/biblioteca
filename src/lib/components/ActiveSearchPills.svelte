<script lang="ts" module>
  export type SearchPill = {
    id: string;
    label: string;
    removeLabel: string;
    kind: 'country' | 'genre' | 'text' | 'year' | 'type' | 'radar';
    value?: unknown;
  };
</script>

<script lang="ts">
  // Filtros activos (U10). Una banda horizontal desplazable con chips
  // compactos: en móvil y en la hoja siempre; en desktop las chips pasan a
  // varias líneas si no caben. Sustituye la fila medida con "+N" de E15.
  import { afterUpdate, beforeUpdate, createEventDispatcher } from 'svelte';
  import Chip from '$lib/ui/Chip.svelte';

  export let pills: SearchPill[] = [];
  /** responsive: banda bajo 768 y varias líneas desde 768 · band: siempre banda. */
  export let layout: 'responsive' | 'band' = 'responsive';
  export let label = 'Filtros activos';
  /** Desde 768, en varias líneas: al inicio o centradas (bajo el campo cerrado del inicio, U10b). */
  export let align: 'start' | 'center' = 'start';

  const dispatch = createEventDispatcher<{ remove: SearchPill }>();

  // Al cambiar `align`, las chips se desplazan a su sitio nuevo (FLIP) con la
  // duración y la curva del campo que acompañan, en lugar de saltar.
  let list: HTMLUListElement | undefined;
  let previousAlign = align;
  let before: Map<Element, DOMRect> | null = null;

  beforeUpdate(() => {
    if (list && align !== previousAlign) {
      before = new Map(Array.from(list.children, (item) => [item, item.getBoundingClientRect()]));
    }
  });

  afterUpdate(() => {
    previousAlign = align;
    const from = before;
    before = null;
    if (!from || !list || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const style = getComputedStyle(list);
    const duration = Number.parseFloat(style.getPropertyValue('--motion-fast')) || 0;
    const easing = style.getPropertyValue('--ease-expressive').trim() || 'ease-out';
    for (const item of list.children) {
      const start = from.get(item);
      if (!start) continue;
      const end = item.getBoundingClientRect();
      const dx = start.left - end.left;
      const dy = start.top - end.top;
      if (!dx && !dy) continue;
      item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing });
    }
  });
</script>

{#if pills.length}
  <ul class="pills pills--{layout}" class:pills--center={align === 'center'} aria-label={label} bind:this={list}>
    {#each pills as pill (pill.id)}
      <li>
        <Chip
          kind="filter"
          class="chip-activo"
          label={pill.label}
          removeLabel={pill.removeLabel}
          title={pill.label}
          onremove={() => dispatch('remove', pill)}
        />
      </li>
    {/each}
  </ul>
{/if}

<style>
  .pills {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    /* Las chips miden 32 y su área táctil 44: el relleno vertical la contiene
       dentro de la banda, que recorta lo que sobresale al desplazarse. */
    padding: calc((var(--target-touch) - var(--chip-h-md)) / 2) 0;
    list-style: none;
  }
  .pills li { display: flex; flex: none; max-width: min(19rem, 72vw); }

  .pills--band {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-padding-inline: var(--space-2);
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .pills--band::-webkit-scrollbar { display: none; }

  @media (max-width: 767px) {
    .pills--responsive {
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .pills--responsive::-webkit-scrollbar { display: none; }
  }
  @media (min-width: 768px) {
    .pills--responsive { flex-wrap: wrap; row-gap: calc(var(--target-touch) - var(--chip-h-md)); }
    /* Solo en varias líneas: una banda desplazable centrada cortaría su inicio. */
    .pills--responsive.pills--center { justify-content: center; }
  }
</style>
