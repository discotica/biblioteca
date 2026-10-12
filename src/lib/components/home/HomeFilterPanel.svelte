<script>
  // Panel de búsqueda de desktop (U10): una sola caja con el formulario y el
  // Radar lado a lado desde 1024, apilados por debajo. U10b: lo abre el campo
  // de HomeSearchBar, que pone el contenedor; «Reiniciar filtros» pasa a la
  // segunda fila del formulario y el pie desaparece. Al abrir se despliega
  // desde el campo: se descubre de arriba abajo mientras baja 8 px, y las dos
  // columnas llegan un instante después (CSS, con los tokens de movimiento).
  import { cubicOut } from 'svelte/easing';
  import Filtros from '$lib/components/Filtros.svelte';
  import RadarPanel from './RadarPanel.svelte';

  export let open = false;
  export let id = undefined;
  export let lanzamientos = [];
  export let valores;
  export let radarRef = null;

  function panelOut(node, { duration = 180 } = {}) {
    const h = node.scrollHeight;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return {
      duration: reduced ? 0 : duration,
      easing: cubicOut,
      css: (t) => `opacity: ${t}; overflow: hidden; height: ${h * t}px;`
    };
  }
</script>

{#if open}
<section class="filtros-wrap" {id} aria-label="Búsqueda y filtros" out:panelOut>
  <div class="filtros-caja">
    <div class="filtros-grid">
      <div class="filtros-col filtros-col--form">
        <Filtros
          {lanzamientos}
          {valores}
          layout="panel"
          on:filtrar
          on:reset
        />
      </div>

      <div class="filtros-col filtros-col--radar">
        <RadarPanel
          radar={valores.radar}
          bind:this={radarRef}
          on:filtrarRadar
        />
      </div>
    </div>
  </div>
</section>
{/if}

<style>
  /* El recorte deja ver la sombra de la caja (0 18px 50px) por los lados y abajo. */
  .filtros-wrap { animation: filtros-despliegue var(--motion-base) var(--ease-expressive); }
  .filtros-col { animation: filtros-llegada var(--motion-overlay) var(--ease-expressive) backwards; }
  .filtros-col--form { animation-delay: 20ms; }
  .filtros-col--radar { animation-delay: 50ms; }

  @keyframes filtros-despliegue {
    from { opacity: 0; transform: translateY(-8px); clip-path: inset(-20px -60px 100% -60px); }
    to { opacity: 1; transform: none; clip-path: inset(-20px -60px -80px -60px); }
  }

  @keyframes filtros-llegada {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }

  /* La regla global acorta la duración pero no el retraso: sin animación. */
  @media (prefers-reduced-motion: reduce) {
    .filtros-wrap, .filtros-col { animation: none; }
  }

  /* Una caja para todo el panel: sin tarjetas anidadas. */
  .filtros-caja {
    border: 1px solid var(--color-borde);
    border-radius: var(--radius-lg);
    background: var(--color-superficie-1);
    box-shadow: 0 18px 50px var(--color-sombra);
  }

  .filtros-grid {
    display: grid;
    align-items: start;
  }

  .filtros-col { min-width: 0; padding: var(--space-4) var(--space-5); }
  .filtros-col--radar { border-top: 1px solid var(--color-linea-sutil); }

  @media (min-width: 1024px) {
    .filtros-grid { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
    .filtros-col--radar { border-top: 0; border-left: 1px solid var(--color-linea-sutil); }
  }
</style>
