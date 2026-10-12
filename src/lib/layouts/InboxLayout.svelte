<script module lang="ts">
  export type InboxGroup<T> = {
    id: string;
    label: string;
    /** Una línea bajo el nombre del grupo. */
    help?: string;
    /** Texto cuando el grupo está vacío. */
    empty: string;
    items: T[];
  };
</script>

<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import Button from '$lib/ui/Button.svelte';

  type Props = {
    /** Nombre accesible de la lista ("Propuestas en cola"). */
    label: string;
    /** Grupos de la lista, cada uno con su nombre y su número. */
    groups: InboxGroup<T>[];
    /** Clave estable de cada elemento. */
    key: (item: T) => string;
    /** Un elemento de la lista; normalmente un InboxItem. */
    item: Snippet<[T]>;
    /** Hay un elemento abierto. Por debajo de 768 se ve el detalle en lugar de la lista. */
    open: boolean;
    /** Detalle del elemento abierto, o lo que se ve sin ninguno. */
    detail: Snippet;
    /** Por debajo de 768: vuelve del detalle a la lista. */
    backLabel?: string;
    onback?: () => void;
    class?: string;
  };

  let { label, groups, key, item, open, detail, backLabel = 'Volver a la lista', onback, class: className = '' }: Props = $props();

  const uid = $props.id();
</script>

<!--
  Bandeja del Estudio (U17): lista a la izquierda y detalle a la derecha. Por
  debajo de 768, primero la lista y, al abrir un elemento, solo su detalle con
  un botón para volver. Quién elige y cómo vive en la URL es de cada sección.
-->
<div class="l-inbox {className}" data-view={open ? 'detail' : 'list'}>
  <div class="l-inbox__list" role="region" aria-label={label}>
    {#each groups as group (group.id)}
      <section class="l-inbox__group" aria-labelledby="{uid}-{group.id}">
        <header class="l-inbox__group-head">
          <h2 class="l-inbox__group-title" id="{uid}-{group.id}">{group.label}</h2>
          <span class="l-inbox__group-count" aria-label="{group.items.length} en {group.label}">{group.items.length}</span>
        </header>
        {#if group.help}<p class="l-inbox__group-help">{group.help}</p>{/if}
        {#if group.items.length}
          <ul class="l-inbox__items">
            {#each group.items as entry (key(entry))}<li>{@render item(entry)}</li>{/each}
          </ul>
        {:else if group.empty}
          <p class="l-inbox__empty">{group.empty}</p>
        {/if}
      </section>
    {/each}
  </div>

  <div class="l-inbox__detail">
    {#if open && onback}
      <div class="l-inbox__back"><Button variant="ghost" size="sm" icon="chevron-izquierda" onclick={onback}>{backLabel}</Button></div>
    {/if}
    {@render detail()}
  </div>
</div>

<style>
  .l-inbox {
    display: grid;
    grid-template-columns: minmax(0, var(--tool-inbox-list-w)) minmax(0, 1fr);
    gap: var(--density-pad);
    align-items: start;
  }

  /* La lista acompaña el scroll del detalle y se desplaza por dentro. */
  .l-inbox__list {
    position: sticky;
    top: calc(var(--header-offset) + var(--space-5));
    max-height: calc(100dvh - var(--header-offset) - var(--space-5) * 2);
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-base);
    background: var(--color-superficie-1);
    transition: top var(--motion-slow) var(--ease-emphasized);
  }

  .l-inbox__group + .l-inbox__group { border-top: 1px solid var(--color-linea); }

  .l-inbox__group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) 0;
  }

  .l-inbox__group-title {
    margin: 0;
    color: var(--color-texto-tenue);
    font-size: var(--density-label);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }

  .l-inbox__group-count {
    min-width: var(--chip-h-sm);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-3);
    color: var(--color-texto);
    font-size: var(--text-2xs);
    line-height: var(--chip-h-sm);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .l-inbox__group-help {
    margin: var(--space-1) 0 0;
    padding: 0 var(--space-4);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    line-height: 1.45;
  }

  .l-inbox__items {
    display: flex;
    flex-direction: column;
    margin: var(--space-2) 0 0;
    padding: 0 0 var(--space-2);
    list-style: none;
  }

  .l-inbox__empty {
    margin: 0;
    padding: var(--space-3) var(--space-4) var(--space-4);
    color: var(--color-texto-tenue);
    font-size: var(--density-text);
  }

  .l-inbox__detail { min-width: 0; }

  .l-inbox__back { display: none; }

  @media (prefers-reduced-motion: reduce) {
    .l-inbox__list { transition: none; }
  }

  /* Tablet: la lista cede ancho al detalle. */
  @media (max-width: 1023px) {
    .l-inbox { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
  }

  /* Móvil: un panel cada vez, la lista con el scroll de la página. */
  @media (max-width: 767px) {
    .l-inbox { grid-template-columns: minmax(0, 1fr); }
    .l-inbox__list { position: static; max-height: none; overflow: visible; }
    .l-inbox[data-view='detail'] .l-inbox__list,
    .l-inbox[data-view='list'] .l-inbox__detail { display: none; }
    .l-inbox__back { display: block; margin: 0 0 var(--space-2) calc(-1 * var(--space-2)); }
  }
</style>
