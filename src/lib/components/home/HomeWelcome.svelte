<script lang="ts">
  // Bienvenida editorial del inicio (E20; permanente desde U11). Bloque en el
  // flujo, no modal: la regla de sesión (una vez por pestaña, solo al entrar
  // directo a /) la decide la página con welcomeSession.ts.
  // Composición de la ficha: ilustración a la izquierda e información a la
  // derecha; en móvil, la información primero y la ilustración como banda.
  import Button from '$lib/ui/Button.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import CoverFallback from '$lib/components/CoverFallback.svelte';
  import { WELCOME_CONTENT, type WelcomeContent } from '$lib/content/welcome';

  type Props = {
    content?: WelcomeContent;
    onclose?: () => void;
    onexplore?: () => void;
  };

  let { content = WELCOME_CONTENT, onclose, onexplore }: Props = $props();
</script>

<section class="welcome l-container l-container--wide" aria-labelledby="welcome-title" data-welcome-banner>
  <div class="welcome__block">
    <!-- Hueco de la ilustración de marca: se cambia en content/welcome.ts. -->
    <div class="welcome__art" data-welcome-illustration>
      {#if content.illustration}
        <img class="welcome__img" src={content.illustration.src} alt={content.illustration.alt} />
      {:else}
        <CoverFallback />
      {/if}
    </div>

    <div class="welcome__copy">
      <p class="welcome__eyebrow">{content.eyebrow}</p>
      <h1 class="welcome__title" id="welcome-title">{content.title}</h1>
      <p class="welcome__description">{content.description}</p>
      <Button onclick={() => onexplore?.()}>{content.cta}</Button>
    </div>

    <IconButton
      class="welcome__close"
      icon="cerrar"
      label={content.closeLabel}
      tooltip="bottom"
      tooltipAlign="end"
      onclick={() => onclose?.()}
    />
  </div>
</section>

<style>
  .welcome { margin-top: var(--space-5); margin-bottom: var(--space-2); }

  .welcome__block {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    overflow: hidden;
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-lg);
    background: var(--color-panel);
  }

  /* La proporción es el alto mínimo; si el texto es más alto (tablet), el hueco
     se estira con la fila y el arte se recorta para llenarlo. */
  .welcome__art {
    align-self: stretch;
    width: 100%;
    aspect-ratio: var(--welcome-art-ratio);
    background: var(--color-panel-raised);
  }

  .welcome__img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .welcome__copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-width: 0;
    padding: var(--space-7);
  }

  .welcome__eyebrow {
    margin: 0 0 var(--space-3);
    color: var(--color-acento);
    font-size: var(--text-2xs);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    line-height: 1.2;
    text-transform: uppercase;
  }

  .welcome__title {
    max-width: var(--welcome-title-measure);
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-display);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .welcome__description {
    max-width: var(--welcome-copy-measure);
    margin: var(--space-4) 0 var(--space-5);
    color: var(--color-texto-medio);
    font-size: var(--text-lg);
    line-height: 1.5;
  }

  .welcome__block :global(.welcome__close) {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
  }

  @media (max-width: 768px) {
    .welcome { margin-top: var(--space-3); }
    .welcome__block { grid-template-columns: minmax(0, 1fr); }
    .welcome__art { order: 1; aspect-ratio: var(--welcome-art-ratio-narrow); }
    .welcome__copy { padding: var(--space-5); }
    /* El antetítulo comparte franja con el cierre; el título empieza debajo. */
    .welcome__eyebrow { padding-right: var(--target-touch); }
    .welcome__title { max-width: none; }
    .welcome__description { font-size: var(--text-md); }
  }
</style>
