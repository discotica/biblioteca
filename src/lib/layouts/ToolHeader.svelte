<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** h1 de la vista. */
    title: string;
    /**
     * Conteo junto al título (U20, guía de voz: «Catálogo 2.790»). Se formatea
     * con separador de miles; 0 también se muestra.
     */
    count?: number;
    /**
     * @deprecated U20: el Estudio va sin subtítulo bajo el h1 (guía de voz del
     * rediseño, regla 1). Se conserva mientras U21–U24 quitan los de cada
     * sección; no lo uses en vistas nuevas. Lo que decía pasa a `count`, a un
     * tooltip o desaparece.
     */
    description?: string;
    /** Acciones de la vista, a la derecha del título; debajo en móvil. */
    actions?: Snippet;
    class?: string;
  };

  let { title, count, description, actions, class: className = '' }: Props = $props();
</script>

<!-- Cabecera de una sección del Estudio (U15). La usan ToolLayout con `title` y
     cada sección cuando el layout vive en un +layout.svelte. Título, conteo y
     acciones en una fila (U20). -->
<header class="l-tool-header {className}">
  <div class="l-tool-header__text">
    <h1 class="l-tool-header__title">
      {title}{#if count !== undefined}{' '}<span class="l-tool-header__count">{count.toLocaleString('es-CO')}</span>{/if}
    </h1>
    {#if description}<p class="l-tool-header__description">{description}</p>{/if}
  </div>
  {#if actions}<div class="l-tool-header__actions">{@render actions()}</div>{/if}
</header>

<style>
  .l-tool-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3) var(--tool-gap-col);
    margin-bottom: var(--tool-gap-header);
  }

  .l-tool-header__text { min-width: 0; }

  .l-tool-header__title {
    margin: 0;
    color: var(--color-texto);
    font-size: var(--text-2xl);
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: var(--leading-heading);
  }

  /* El conteo acompaña al título sin competir: tenue, más pequeño, en la base. */
  .l-tool-header__count {
    margin-left: var(--space-1);
    color: var(--color-texto-tenue);
    font-size: var(--text-sm);
    font-weight: 500;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  .l-tool-header__description {
    margin: var(--space-1) 0 0;
    color: var(--color-texto-tenue);
    font-size: var(--density-text);
  }

  .l-tool-header__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
</style>
