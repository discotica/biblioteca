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
  import { afterUpdate, beforeUpdate, createEventDispatcher, onDestroy, tick } from 'svelte';
  import Chip from '$lib/ui/Chip.svelte';
  import Icon from '$lib/ui/Icon.svelte';

  export let pills: SearchPill[] = [];
  /** responsive: banda bajo 768 y varias líneas desde 768 · band: siempre banda. */
  export let layout: 'responsive' | 'band' = 'responsive';
  export let label = 'Filtros activos';
  /** Desde 768, en varias líneas: al inicio, centradas o al final (en la fila del buscador, U29). */
  export let align: 'start' | 'center' | 'end' = 'start';
  /**
   * U29: con más de `limit` chips, se ven `limit` y el siguiente es «N más», que
   * abre el resto en un panel. 0 = sin tope (la banda móvil y la hoja).
   */
  export let limit = 0;

  const dispatch = createEventDispatcher<{ remove: SearchPill }>();

  // Al cambiar `align`, las chips se desplazan a su sitio nuevo (FLIP) con la
  // duración y la curva del campo que acompañan, en lugar de saltar.
  let list: HTMLUListElement | undefined;
  let previousAlign = align;
  let before: Map<Element, DOMRect> | null = null;

  $: recortar = limit > 0 && pills.length > limit;
  $: visibles = recortar ? pills.slice(0, limit) : pills;
  $: resto = recortar ? pills.slice(limit) : [];

  // «N más»: botón con aria-expanded; el panel va justo después en el DOM, así
  // que Tab entra en él. Esc lo cierra y devuelve el foco al botón; un clic fuera
  // o un foco que sale de la chip también lo cierran.
  const masId = `pills-mas-${Math.random().toString(36).slice(2, 8)}`;
  let masAbierto = false;
  let masItem: HTMLLIElement | undefined;
  let masBoton: HTMLButtonElement | undefined;

  $: if (!resto.length) masAbierto = false;
  $: if (masAbierto) listenOutside(true);
  $: if (!masAbierto) listenOutside(false);

  let escuchando = false;
  function listenOutside(on: boolean) {
    if (typeof document === 'undefined' || on === escuchando) return;
    escuchando = on;
    if (on) document.addEventListener('pointerdown', fuera, true);
    else document.removeEventListener('pointerdown', fuera, true);
  }
  function fuera(event: Event) {
    if (masItem && !masItem.contains(event.target as Node)) masAbierto = false;
  }
  onDestroy(() => listenOutside(false));

  function masKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !masAbierto) return;
    event.stopPropagation();
    masAbierto = false;
    masBoton?.focus();
  }
  function masFocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (masAbierto && next && masItem && !masItem.contains(next)) masAbierto = false;
  }
  async function quitarDelResto(pill: SearchPill) {
    dispatch('remove', pill);
    await tick();
    // El chip quitado se lleva el foco: vuelve al botón mientras quede algo.
    if (masAbierto && masBoton?.isConnected) masBoton.focus();
  }

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
  <ul class="pills pills--{layout}" class:pills--center={align === 'center'} class:pills--end={align === 'end'} aria-label={label} bind:this={list}>
    {#each visibles as pill (pill.id)}
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
    {#if resto.length}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions: el Esc y la salida del foco se escuchan en la chip que contiene el botón y el panel. -->
      <li class="pills__mas" class:pills__mas--abierto={masAbierto} bind:this={masItem} on:keydown={masKeydown} on:focusout={masFocusout}>
        <button
          type="button"
          class="pills__mas-boton"
          bind:this={masBoton}
          aria-expanded={masAbierto}
          aria-controls={masId}
          aria-label={`${resto.length} más, filtros activos`}
          on:click={() => (masAbierto = !masAbierto)}
        >
          <span>{resto.length} más</span>
          <Icon name={masAbierto ? 'chevron-arriba' : 'chevron-abajo'} size="sm" />
        </button>
        {#if masAbierto}
          <div class="pills__mas-panel" id={masId} role="group" aria-label="Más filtros activos">
            {#each resto as pill (pill.id)}
              <Chip
                kind="filter"
                class="chip-activo"
                label={pill.label}
                removeLabel={pill.removeLabel}
                title={pill.label}
                onremove={() => quitarDelResto(pill)}
              />
            {/each}
          </div>
        {/if}
      </li>
    {/if}
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
    .pills--responsive.pills--end { justify-content: flex-end; }
  }

  /* «N más» (U29, tablero D): chip de contorno con caret; abierto, el borde pasa
     a texto pleno y el resto cae en un panel bajo la chip. */
  .pills__mas { position: relative; }
  .pills__mas-boton {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--chip-h-md);
    box-sizing: border-box;
    padding: 0 var(--space-3) 0 var(--chip-px-md);
    border: 1px solid var(--color-linea-fuerte);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-texto);
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: border-color var(--motion-fast) var(--ease-standard);
  }
  .pills__mas-boton:hover,
  .pills__mas--abierto .pills__mas-boton { border-color: var(--color-texto); }
  .pills__mas-boton:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; box-shadow: var(--focus-ring); }
  /* Área táctil de 44 sin cambiar la caja visible. */
  .pills__mas-boton::after { content: ''; position: absolute; inset-block: calc((var(--chip-h-md) - var(--target-touch)) / 2); inset-inline: 0; }

  .pills__mas-panel {
    position: absolute;
    z-index: var(--layer-dropdown);
    top: calc(100% + var(--space-2));
    inset-inline-end: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    box-sizing: border-box;
    padding: var(--space-3);
    background: var(--color-panel);
    border: 1px solid var(--color-linea-fuerte);
    border-radius: var(--radius-sm);
    box-shadow: 0 16px 48px var(--color-sombra-fuerte);
  }
</style>
