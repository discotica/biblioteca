<script lang="ts">
  // Compartir de la tarjeta, la fila (U8) y la ficha (U9): IconButton que copia
  // el enlace público. Al copiar, el icono pasa a ✓ y la ayuda a "Enlace copiado";
  // un lector de pantalla lo oye por la región viva.
  import { onDestroy } from 'svelte';
  import { IconButton } from '$lib/ui';
  import { shareUrl } from './lanzamiento';

  type Props = {
    slug: string;
    /** sm en la tarjeta y la fila; md en la ficha de escritorio. */
    size?: 'sm' | 'md';
    /** Discreto: el tono de los metadatos hasta que se apunta (tarjeta y fila). */
    quiet?: boolean;
    class?: string;
  };

  let { slug, size = 'sm', quiet = true, class: className = '' }: Props = $props();

  const COPIED_MS = 1500;
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function share() {
    navigator.clipboard
      ?.writeText?.(shareUrl(slug))
      .then(() => {
        copied = true;
        clearTimeout(timer);
        timer = setTimeout(() => (copied = false), COPIED_MS);
      })
      .catch(() => {});
  }

  onDestroy(() => clearTimeout(timer));
</script>

<span class="compartir {className}" class:compartir--quiet={quiet}>
  <IconButton
    icon={copied ? 'check' : 'compartir'}
    label={copied ? 'Enlace copiado' : 'Copiar enlace'}
    {size}
    variant="ghost"
    tooltipAlign="end"
    onclick={share}
  />
  <span class="sr-only" role="status">{copied ? 'Enlace copiado' : ''}</span>
</span>

<style>
  .compartir { display: inline-flex; flex: none; }
  /* Discreto: el tono de los metadatos hasta que se apunta o se enfoca. */
  .compartir--quiet :global(.ui-btn--ghost) { color: var(--color-texto-tenue); }
  .compartir--quiet :global(.ui-btn--ghost:hover),
  .compartir--quiet :global(.ui-btn--ghost:focus-visible) { color: var(--color-texto); }
</style>
