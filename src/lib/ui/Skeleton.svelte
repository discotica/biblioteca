<script lang="ts">
  type Props = {
    /**
     * card: misma composición que la tarjeta de la grilla (portada cuadrada,
     * artista, título, metadatos y géneros).
     * row: fila del modo lista (miniatura y dos líneas).
     */
    variant: 'card' | 'row';
    class?: string;
  };

  let { variant, class: className = '' }: Props = $props();
</script>

<!-- Decorativo: quien lo use anuncia la carga con LoadingIndicator. -->
{#if variant === 'card'}
  <div class="ui-skeleton ui-skeleton--card {className}" aria-hidden="true">
    <div class="ui-skeleton__cover ui-skeleton__block"></div>
    <div class="ui-skeleton__body">
      <span class="ui-skeleton__line ui-skeleton__block" style:--w="45%"></span>
      <span class="ui-skeleton__line ui-skeleton__line--title ui-skeleton__block" style:--w="85%"></span>
      <span class="ui-skeleton__line ui-skeleton__block" style:--w="60%"></span>
      <span class="ui-skeleton__chips">
        <span class="ui-skeleton__chip ui-skeleton__block"></span>
        <span class="ui-skeleton__chip ui-skeleton__block"></span>
      </span>
    </div>
  </div>
{:else}
  <div class="ui-skeleton ui-skeleton--row {className}" aria-hidden="true">
    <div class="ui-skeleton__thumb ui-skeleton__block"></div>
    <div class="ui-skeleton__body">
      <span class="ui-skeleton__line ui-skeleton__line--title ui-skeleton__block" style:--w="55%"></span>
      <span class="ui-skeleton__line ui-skeleton__block" style:--w="35%"></span>
    </div>
  </div>
{/if}

<style>
  .ui-skeleton {
    box-sizing: border-box;
    border: 1px solid var(--color-borde);
    background: var(--color-panel);
    overflow: hidden;
  }

  .ui-skeleton__block {
    display: block;
    background: linear-gradient(90deg, var(--color-superficie-2) 0%, var(--color-superficie-3) 50%, var(--color-superficie-2) 100%);
    background-size: 200% 100%;
    animation: ui-skeleton-sweep 1.4s var(--ease-standard) infinite;
  }

  /* ---- Tarjeta ---- */
  .ui-skeleton--card {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: var(--radius-base);
  }
  .ui-skeleton__cover { aspect-ratio: 1; width: 100%; }
  .ui-skeleton--card .ui-skeleton__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .ui-skeleton__line {
    width: var(--w, 100%);
    height: var(--text-2xs);
    border-radius: var(--radius-xs);
  }
  .ui-skeleton__line--title { height: var(--text-md); }

  .ui-skeleton__chips { display: flex; gap: var(--space-1); }
  .ui-skeleton__chip { width: var(--space-8); height: var(--chip-h-sm); border-radius: var(--radius-pill); }

  /* ---- Fila ---- */
  .ui-skeleton--row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: var(--density-row-h);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
  }
  .ui-skeleton__thumb { flex: none; width: var(--control-h-xl); aspect-ratio: 1; border-radius: var(--radius-xs); }
  .ui-skeleton--row .ui-skeleton__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-2);
  }

  @keyframes ui-skeleton-sweep {
    from { background-position: 100% 0; }
    to { background-position: -100% 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-skeleton__block { animation: none; }
  }
</style>
