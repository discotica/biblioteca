<script lang="ts">
  // Géneros de la tarjeta y la fila (U8): hasta tres Chip enlazados en una sola
  // línea y "+N" con el resto. Si no caben, los chips se truncan; la línea nunca
  // salta a una segunda.
  import { goto } from '$app/navigation';
  import { Chip } from '$lib/ui';
  import { filterHref, isModifiedClick } from './lanzamiento';

  type Props = {
    genres: string[];
    /** Los que no se muestran: solo cuentan para "+N". */
    more?: string[];
    /** Búsqueda actual (`$page.url.search`), para conservar los filtros. */
    search: string;
    class?: string;
  };

  let { genres, more = [], search, class: className = '' }: Props = $props();

  function onGenreClick(event: MouseEvent, href: string) {
    if (isModifiedClick(event)) return;
    event.preventDefault();
    goto(href, { invalidateAll: true });
  }
</script>

<div class="generos {className}">
  {#each genres as genre (genre)}
    {@const href = filterHref('genero', genre, search)}
    <Chip kind="genre" size="sm" label={genre} {href} title={genre} onclick={(event: MouseEvent) => onGenreClick(event, href)} />
  {/each}
  {#if more.length}
    <span class="generos__mas" title={more.join(', ')}>+{more.length}<span class="sr-only"> {more.length === 1 ? 'género' : 'géneros'} más: {more.join(', ')}</span></span>
  {/if}
</div>

<style>
  .generos {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    min-height: var(--chip-h-sm);
  }
  /* Los chips ceden ancho y truncan su texto antes que partir la línea. */
  .generos :global(a.ui-chip) { flex: 0 1 auto; min-width: 0; }
  .generos__mas {
    flex: none;
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
  }
</style>
