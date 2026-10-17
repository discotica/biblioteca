<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    /** h1 de la vista. */
    title: string;
    /** Una línea bajo el título (contexto o filtro activo). */
    description?: string;
    /** Acciones de la vista, a la derecha del título; debajo en móvil. */
    actions?: Snippet;
    class?: string;
  };

  let { title, description, actions, class: className = '' }: Props = $props();
</script>

<!-- Cabecera de una sección del Estudio (U15). La usan ToolLayout con `title` y
     cada sección cuando el layout vive en un +layout.svelte. -->
<header class="l-tool-header {className}">
  <div class="l-tool-header__text">
    <h1 class="l-tool-header__title">{title}</h1>
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
    gap: var(--space-3);
    margin-bottom: var(--density-pad);
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

  .l-tool-header__description {
    margin: var(--space-1) 0 0;
    color: var(--color-texto-tenue);
    font-size: var(--density-text);
  }

  .l-tool-header__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
</style>
