<script lang="ts">
  // Año · país · sello en una línea (U8). El país filtra el catálogo y el sello
  // lleva a su página. Siempre una línea: el sello cede ancho y se trunca.
  import { goto } from '$app/navigation';
  import { filterHref, isModifiedClick, labelHref } from './lanzamiento';

  type Props = {
    year: string;
    country: string;
    label: string;
    /** Búsqueda actual (`$page.url.search`), para conservar los filtros. */
    search: string;
    class?: string;
  };

  let { year, country, label, search, class: className = '' }: Props = $props();

  const countryHref = $derived(country ? filterHref('pais', country, search) : '');

  function onCountryClick(event: MouseEvent) {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    goto(countryHref, { invalidateAll: true });
  }
</script>

{#snippet sep()}<span class="datos__sep" aria-hidden="true">·</span>{/snippet}

{#if year || country || label}
  <p class="datos {className}">
    {#if year}<span class="datos__ano">{year}</span>{/if}
    {#if year && country}{@render sep()}{/if}
    {#if country}<a class="datos__pais" href={countryHref} title={country} onclick={onCountryClick}>{country}</a>{/if}
    {#if (year || country) && label}{@render sep()}{/if}
    {#if label}<a class="datos__sello" href={labelHref(label, search)} title={label}>{label}</a>{/if}
  </p>
{:else}
  <p class="datos {className}" aria-hidden="true"></p>
{/if}

<style>
  /* Paso tipográfico de metadatos (U4: --text-2xs, 12 px, contraste ≥ 4.5:1). */
  .datos {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    min-width: 0;
    min-height: 1lh;
    margin: 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    line-height: 1.43;
    white-space: nowrap;
  }

  .datos > * { min-width: 0; }
  .datos__ano { flex: none; letter-spacing: .03em; }
  .datos__pais { flex: 0 1 auto; max-width: 40%; }
  .datos__sello { flex: 0 1 auto; font-style: italic; }
  .datos__pais,
  .datos__sello {
    overflow: hidden;
    text-overflow: ellipsis;
    color: inherit;
    font-weight: 500;
    text-decoration: none;
    transition: color var(--motion-fast) var(--ease-standard);
  }
  .datos__pais:hover,
  .datos__sello:hover { color: var(--color-texto-alto); text-decoration: underline; }
  .datos__pais:focus-visible,
  .datos__sello:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; border-radius: var(--radius-xs); }

  .datos__sep { flex: none; color: var(--color-texto-desactivado); }
</style>
