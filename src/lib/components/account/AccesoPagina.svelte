<script lang="ts">
  import type { Snippet } from 'svelte';
  import AccesoFondo from './AccesoFondo.svelte';

  type Props = {
    /** wide: Entrar y el onboarding, en el ancho del sitio. narrow: las vistas cortas, centradas. */
    contenedor?: 'wide' | 'narrow';
    /** centro: el contenido a media altura. inicio: pegado a la izquierda del contenedor, con la huella a la vista. */
    alinea?: 'centro' | 'inicio';
    nombre?: string;
    color?: boolean;
    latido?: number;
    velo?: boolean;
    class?: string;
    children?: Snippet;
  };

  let { contenedor = 'narrow', alinea = 'centro', nombre = '', color = false, latido = 0, velo = false, class: className = '', children }: Props = $props();
</script>

<!--
  Escena de las pantallas de acceso (U30): el contenedor del sistema sobre la
  huella de fondo. El panel (FormPanel) lo pone cada página.
-->
<div class="l-container l-container--{contenedor} acceso acceso--{alinea} {className}">
  <AccesoFondo {nombre} {color} {latido} {velo} />
  {@render children?.()}
</div>

<style>
  .acceso {
    display: flex;
    flex-direction: column;
    min-height: max(var(--acceso-alto-min), calc(100svh - var(--header-h) - var(--acceso-pie)));
    padding-block: var(--space-7);
  }
  /* El contenido, en el mismo nivel que el fondo fijo y después de él: queda encima. */
  .acceso > :global(:not(.acceso-fondo)) { position: relative; }
  .acceso--centro { align-items: center; justify-content: center; }
  .acceso--inicio { align-items: flex-start; justify-content: flex-start; padding-top: var(--acceso-inicio-top); }

  @media (max-width: 767px) {
    .acceso {
      min-height: max(var(--acceso-alto-min), calc(100svh - var(--header-h-mobile) - var(--acceso-pie)));
      padding-block: var(--space-5);
    }
    .acceso--inicio { padding-top: var(--acceso-inicio-top-movil); }
  }
</style>
