<script lang="ts">
  // Barra de consentimiento de analítica (GA4). Solo existe con un ID de
  // medición configurado y mientras la persona no haya elegido. No es modal:
  // no bloquea el sitio ni roba el foco; flota al pie y se puede ignorar.
  // Aceptar y Rechazar pesan lo mismo (ninguno es la acción destacada): el
  // rechazo tiene que ser tan fácil como la aceptación. La elección se cambia
  // después en /privacidad#cookies.
  import Button from '$lib/ui/Button.svelte';
  import { analyticsConsent, analyticsEnabled, setAnalyticsConsent } from '$lib/analytics';
</script>

{#if analyticsEnabled && $analyticsConsent === null}
  <section class="consentimiento" aria-labelledby="consentimiento-titulo" data-consentimiento-analitica>
    <div class="consentimiento__texto">
      <h2 id="consentimiento-titulo" class="consentimiento__titulo">Cookies de analítica</h2>
      <p>
        Con tu permiso usamos Google Analytics para saber qué partes de la biblioteca se usan.
        No las usamos para publicidad. <a href="/privacidad#cookies">Más información</a>
      </p>
    </div>
    <div class="consentimiento__acciones">
      <Button variant="secondary" size="sm" onclick={() => setAnalyticsConsent('denied')}>Rechazar</Button>
      <Button variant="secondary" size="sm" onclick={() => setAnalyticsConsent('granted')}>Aceptar</Button>
    </div>
  </section>
{/if}

<style>
  .consentimiento {
    position: fixed;
    inset-inline: var(--space-4);
    bottom: calc(var(--space-4) + var(--safe-area-bottom));
    z-index: var(--layer-toast);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    max-width: 44rem;
    margin-inline: auto;
    padding: var(--space-3) var(--space-4);
    box-sizing: border-box;
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-sm);
    background: var(--color-panel);
    box-shadow: var(--shadow-flotante);
    color: var(--color-texto);
    font-size: var(--text-sm);
  }

  .consentimiento__texto { flex: 1; min-width: 0; }
  .consentimiento__titulo { margin: 0 0 var(--space-1); font-size: var(--text-sm); font-weight: 700; }
  .consentimiento p { margin: 0; color: var(--color-texto-tenue); }
  .consentimiento a { color: var(--color-texto); }

  .consentimiento__acciones { display: flex; flex: none; gap: var(--space-2); }

  @media (max-width: 768px) {
    .consentimiento { flex-direction: column; align-items: stretch; gap: var(--space-3); }
    .consentimiento__acciones > :global(*) { flex: 1; }
  }
</style>
