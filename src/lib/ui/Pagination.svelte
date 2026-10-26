<script lang="ts">
  import IconButton from './IconButton.svelte';
  import { clampPage, paginationItems } from './pagination';

  type Props = {
    page: number;
    totalPages: number;
    /** Recibe la página nueva. Con hrefFor también se llama (puede hacer preventDefault). */
    onchange?: (page: number, event: MouseEvent) => void;
    /** Con hrefFor cada página es un enlace real (?p=N). */
    hrefFor?: (page: number) => string;
    label?: string;
    /**
     * compact (por defecto desde U10): ‹ 5 de 233 ›, no cambia de ancho al
     *   pasar de página; es la paginación de todas las vistas del catálogo.
     * full: números.
     * auto: compact por debajo de 768 y full desde 768.
     */
    variant?: 'full' | 'compact' | 'auto';
    /** md 44 · sm 32 (área táctil de 44) */
    size?: 'sm' | 'md';
    class?: string;
  };

  let {
    page,
    totalPages,
    onchange,
    hrefFor,
    label = 'Paginación',
    variant = 'compact',
    size = 'md',
    class: className = ''
  }: Props = $props();

  const current = $derived(clampPage(page, totalPages));
  const total = $derived(Math.max(1, Math.floor(totalPages)));
  const items = $derived(paginationItems(current, total));
  const formatter = new Intl.NumberFormat('es-CO');

  function go(next: number, event: MouseEvent) {
    if (next < 1 || next > total || next === current) {
      event.preventDefault();
      return;
    }
    onchange?.(next, event);
  }
</script>

{#snippet arrow(direction: 'prev' | 'next')}
  {@const target = direction === 'prev' ? current - 1 : current + 1}
  {@const inactive = target < 1 || target > total}
  <IconButton
    icon={direction === 'prev' ? 'chevron-izquierda' : 'chevron-derecha'}
    label={direction === 'prev' ? 'Página anterior' : 'Página siguiente'}
    variant="secondary"
    {size}
    href={hrefFor && !inactive ? hrefFor(target) : undefined}
    disabled={inactive}
    tooltipAlign={direction === 'prev' ? 'start' : 'end'}
    onclick={(event: MouseEvent) => go(target, event)}
  />
{/snippet}

{#if total > 1}
  <nav class="ui-pagination ui-pagination--{variant} ui-pagination--{size} {className}" aria-label={label}>
    {#if variant !== 'compact'}
      <ul class="ui-pagination__full">
        <li>{@render arrow('prev')}</li>
        {#each items as item, index (item === 'gap' ? `gap-${index}` : item)}
          <li>
            {#if item === 'gap'}
              <span class="ui-pagination__gap" aria-hidden="true">…</span>
            {:else if hrefFor}
              <a
                class="ui-pagination__page"
                href={hrefFor(item)}
                aria-current={item === current ? 'page' : undefined}
                aria-label={`Página ${item}`}
                onclick={(event) => go(item, event)}>{formatter.format(item)}</a
              >
            {:else}
              <button
                type="button"
                class="ui-pagination__page"
                aria-current={item === current ? 'page' : undefined}
                aria-label={`Página ${item}`}
                onclick={(event) => go(item, event)}>{formatter.format(item)}</button
              >
            {/if}
          </li>
        {/each}
        <li>{@render arrow('next')}</li>
      </ul>
    {/if}
    {#if variant !== 'full'}
      <div class="ui-pagination__compact">
        {@render arrow('prev')}
        <span class="ui-pagination__status">
          <span class="sr-only">Página </span><strong>{formatter.format(current)}</strong> de {formatter.format(total)}
        </span>
        {@render arrow('next')}
      </div>
    {/if}
  </nav>
{/if}

<style>
  .ui-pagination {
    --page-h: var(--button-h-md);
    display: flex;
    min-width: 0;
  }
  .ui-pagination--sm { --page-h: var(--button-h-sm); }

  .ui-pagination__full,
  .ui-pagination__compact {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ui-pagination__full li { display: flex; }
  /* En sm (32) la separación completa los 44 de cada objetivo sin solaparlos. */
  .ui-pagination--sm .ui-pagination__full,
  .ui-pagination--sm .ui-pagination__compact { gap: calc(var(--target-touch) - var(--button-h-sm)); }

  /* Números: misma caja que los botones de flecha, texto centrado en su eje. */
  .ui-pagination__page {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--page-h);
    height: var(--page-h);
    box-sizing: border-box;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--control-radius);
    background: transparent;
    color: var(--color-texto-alto);
    font-family: var(--font-ui);
    font-size: var(--control-font-size);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    transition: background var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard);
  }
  .ui-pagination__page::after {
    content: '';
    position: absolute;
    inset: min(0px, calc((100% - var(--target-touch)) / 2));
  }
  .ui-pagination__page:hover { background: var(--color-superficie-2); color: var(--color-texto); }
  .ui-pagination__page[aria-current='page'] {
    background: var(--color-acento);
    color: var(--color-sobre-acento);
    font-weight: 700;
    cursor: default;
  }
  .ui-pagination__page:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
    box-shadow: var(--focus-ring);
  }

  .ui-pagination__gap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--space-5);
    height: var(--page-h);
    color: var(--color-texto-tenue);
    font-size: var(--control-font-size);
    line-height: 1;
  }

  /* Compacta: el texto ocupa la misma altura que las flechas y se centra en ese eje
     (antes iba a la línea base con dos tamaños y quedaba bajo). */
  .ui-pagination__status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: .3em;
    height: var(--page-h);
    padding: 0 var(--space-2);
    color: var(--color-texto-medio);
    font-size: var(--control-font-size);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
  }
  .ui-pagination__status strong { color: var(--color-texto); font-weight: 700; }

  @media (max-width: 767px) {
    .ui-pagination--auto .ui-pagination__full { display: none; }
  }
  /* En la línea móvil compartida con "Ordenar por", el estado cede su relleno. */
  @media (max-width: 479px) {
    .ui-pagination__status { padding: 0 var(--space-1); }
  }
  @media (min-width: 768px) {
    .ui-pagination--auto .ui-pagination__compact { display: none; }
  }
</style>
