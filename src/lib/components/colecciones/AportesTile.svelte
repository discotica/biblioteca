<script lang="ts">
  // Mis aportes en el perfil propio (U31, tableros F y K). No es una colección:
  // es un tile fijado (borde verde y pin) que abre /mis-aportes. Solo lo ve su
  // dueño (D2). El mosaico son las portadas de los aportes aceptados; sin
  // ninguna, el hueco queda liso, sin el logo de «sin portada».
  import { Icon } from '$lib/ui';
  import CollectionMosaic from './CollectionMosaic.svelte';

  type Props = {
    /** Hasta 4 portadas de aportes aceptados. */
    covers: (string | null)[];
    /** «N lanzamientos · N en revisión», «Sin aportes todavía» o vacío mientras carga. */
    meta: string;
    href?: string;
  };

  let { covers, meta, href = '/mis-aportes' }: Props = $props();
</script>

<article class="aportes-tile">
  <div class="aportes-tile__visual">
    {#if covers.length}
      <CollectionMosaic {covers} />
    {:else}
      <div class="aportes-tile__vacio" aria-hidden="true"></div>
    {/if}
    <span class="aportes-tile__pin" role="img" aria-label="Fijada"><Icon name="pin" size="sm" /></span>
  </div>
  <div class="aportes-tile__text">
    <h3 class="aportes-tile__name"><a class="aportes-tile__link" {href}>Mis aportes</a></h3>
    <p class="aportes-tile__meta">{meta}</p>
  </div>
</article>

<style>
  .aportes-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .aportes-tile__visual { position: relative; }
  /* El borde va por dentro, sobre las portadas: el tile mide lo mismo que los demás. */
  .aportes-tile__visual::after {
    content: '';
    position: absolute;
    inset: 0;
    border: var(--tile-borde-fijada) solid var(--color-acento);
    border-radius: var(--radius-sm);
    pointer-events: none;
  }
  .aportes-tile__vacio {
    aspect-ratio: 1 / 1;
    border-radius: var(--radius-sm);
    background: var(--color-panel-formulario);
  }

  .aportes-tile__pin {
    position: absolute;
    top: 10px;
    left: 10px;
    display: grid;
    place-items: center;
    width: var(--tile-pin);
    height: var(--tile-pin);
    border-radius: 50%;
    background: var(--color-acento);
    color: var(--color-sobre-acento);
  }
  /* 18 en desktop, como los iconos del cabecero; 16 (sm) en móvil. */
  .aportes-tile__pin :global(.ui-icon) { width: var(--icon-nav); height: var(--icon-nav); }

  .aportes-tile__name {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-tile);
    font-weight: 600;
    line-height: var(--text-tile-lh);
  }
  /* Como en CollectionTile: el enlace del nombre cubre todo el tile. */
  .aportes-tile__link { color: inherit; text-decoration: none; }
  .aportes-tile__link::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius-sm); }
  .aportes-tile__link:focus-visible { outline: none; }
  .aportes-tile__link:focus-visible::after { outline: 2px solid var(--focus-ring-color); outline-offset: 2px; box-shadow: var(--focus-ring); }
  .aportes-tile:hover .aportes-tile__name { color: var(--color-acento-texto); }

  .aportes-tile__meta {
    min-height: 1.25rem;
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
    line-height: 1.25rem;
  }

  @media (max-width: 768px) {
    .aportes-tile { gap: var(--space-2); }
    .aportes-tile__pin { top: var(--space-2); left: var(--space-2); width: var(--tile-pin-m); height: var(--tile-pin-m); }
    .aportes-tile__pin :global(.ui-icon) { width: var(--icon-sm); height: var(--icon-sm); }
    .aportes-tile__name { font-size: var(--text-tile-m); line-height: var(--text-tile-m-lh); }
    .aportes-tile__meta { min-height: 1.125rem; font-size: var(--text-xs); line-height: 1.125rem; }
  }
</style>
