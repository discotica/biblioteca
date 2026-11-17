<script module lang="ts">
  /** narrow 480 (vistas cortas: entrar, recuperar, 404) · wide 576 (onboarding, Editar perfil, Ajustes, Reportar, Sugerir). */
  export type FormPanelSize = 'narrow' | 'wide';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    size?: FormPanelSize;
    /** Elemento raíz. Con `form`, los atributos (onsubmit, novalidate…) pasan al formulario. */
    as?: 'div' | 'section' | 'form';
    class?: string;
    /** Bloques de campos: 22 entre uno y otro. */
    children?: Snippet;
    /** Fila de acciones: 36 por debajo de los campos. */
    actions?: Snippet;
    [attribute: string]: unknown;
  };

  let { size = 'narrow', as = 'div', class: className = '', children, actions, ...rest }: Props = $props();
</script>

<!--
  Contenedor de formulario (U26, plan de dirección de arte §3). Superficie opaca
  que se apoya sobre el campo de puntos. El ancho es un máximo: en un viewport
  más estrecho ocupa lo que haya. No centra: lo coloca la página.
-->
<svelte:element this={as} class="ui-form-panel ui-form-panel--{size} {className}" {...rest}>
  {#if children}<div class="ui-form-panel__body">{@render children()}</div>{/if}
  {#if actions}<div class="ui-form-panel__actions">{@render actions()}</div>{/if}
</svelte:element>

<style>
  .ui-form-panel {
    box-sizing: border-box;
    width: 100%;
    max-width: var(--form-panel-w);
    padding: var(--form-panel-pad);
    background: var(--form-panel-bg);
    border: 1px solid var(--form-panel-border);
    border-radius: var(--form-panel-radius);
  }
  .ui-form-panel--wide { max-width: var(--form-panel-w-wide); }

  .ui-form-panel__body {
    display: flex;
    flex-direction: column;
    gap: var(--form-gap-block);
  }

  .ui-form-panel__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .ui-form-panel__body + .ui-form-panel__actions { margin-top: var(--form-gap-actions); }

  @media (max-width: 767px) {
    .ui-form-panel { padding: var(--form-panel-pad-mobile); }
  }
  @media (max-width: 479px) {
    .ui-form-panel { padding: var(--form-panel-pad-compact); }
  }
</style>
