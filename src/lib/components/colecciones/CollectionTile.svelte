<script lang="ts">
  // Colección en un listado (U14): mosaico de 4 portadas y nombre. Toda la pieza
  // abre la colección; el resto de acciones va en el "…" (decisiones.md, ronda 3:
  // "todas menos abrir"), que solo aparece si se pasan `actions`.
  import { Menu, type MenuItem } from '$lib/ui';
  import type { Crate } from '$lib/stores/cratesStore';
  import CollectionMosaic from './CollectionMosaic.svelte';

  type Props = {
    crate: Crate;
    covers: (string | null)[];
    href: string;
    /** Acciones del "…": compartir, editar y eliminar. Sin ellas, no hay menú. */
    actions?: MenuItem[];
    /** Muestra "Privada" en las privadas (Mis colecciones). */
    showVisibility?: boolean;
  };

  let { crate, covers, href, actions, showVisibility = false }: Props = $props();

  const count = $derived(crate.item_count ?? 0);
  const meta = $derived(
    [`${count} ${count === 1 ? 'lanzamiento' : 'lanzamientos'}`, showVisibility && !crate.is_public ? 'Privada' : '']
      .filter(Boolean)
      .join(' · ')
  );
</script>

<article class="collection-tile">
  <CollectionMosaic {covers} />
  <div class="collection-tile__body">
    <div class="collection-tile__text">
      <h3 class="collection-tile__name"><a class="collection-tile__link" {href}>{crate.name}</a></h3>
      <p class="collection-tile__meta">{meta}</p>
    </div>
    {#if actions?.length}
      <Menu label={`Acciones de «${crate.name}»`} items={actions} size="sm" class="collection-tile__menu" />
    {/if}
  </div>
</article>

<style>
  .collection-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .collection-tile__body {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .collection-tile__text { min-width: 0; }

  .collection-tile__name {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-md);
    font-weight: 800;
    line-height: 1.3;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  /* El enlace del nombre se estira sobre toda la pieza (mosaico incluido). */
  .collection-tile__link { color: inherit; text-decoration: none; }
  .collection-tile__link::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius-sm); }
  .collection-tile__link:focus-visible { outline: none; }
  .collection-tile__link:focus-visible::after { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; box-shadow: var(--focus-ring); }
  .collection-tile:hover .collection-tile__name { color: var(--color-acento-texto); }

  .collection-tile__meta {
    margin: var(--space-1) 0 0;
    color: var(--color-texto-tenue);
    font-size: var(--text-xs);
  }

  /* El "…" queda por encima del enlace estirado. */
  .collection-tile__body :global(.collection-tile__menu) { position: relative; z-index: var(--layer-raised); flex: none; }
</style>
