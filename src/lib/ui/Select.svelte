<script lang="ts" module>
  export type SelectOption = { value: string; label: string; disabled?: boolean };
</script>

<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  type Props = {
    /** Etiqueta visible; también es el nombre accesible del control. */
    label: string;
    options: readonly SelectOption[];
    value?: string;
    /**
     * true: la etiqueta solo para lectores de pantalla.
     * compact: se oculta por debajo de 480 px; wide: por debajo de 1024. Para
     * un control junto a otros en una línea (p. ej. "Ordenar por" junto a la
     * paginación), donde el icono y la opción elegida bastan.
     */
    hideLabel?: boolean | 'compact' | 'wide';
    /** Etiqueta a la izquierda del control, en la misma línea. */
    inline?: boolean;
    /** Icono al inicio del control. */
    icon?: IconName;
    /** false: sin icono por debajo de 480 px, para dejar sitio a la opción elegida. */
    compactIcon?: boolean;
    id?: string;
    name?: string;
    disabled?: boolean;
    /** Ayuda bajo el control (U13). */
    hint?: string;
    /** Error bajo el control; marca el borde y aria-invalid (U13). */
    error?: string;
    onchange?: (value: string, event: Event) => void;
    class?: string;
    element?: HTMLSelectElement;
    [attribute: string]: unknown;
  };

  let {
    label,
    options,
    value = $bindable(''),
    hideLabel = false,
    inline = false,
    icon,
    compactIcon = true,
    id,
    name,
    disabled = false,
    hint,
    error,
    onchange,
    class: className = '',
    element = $bindable(),
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const selectId = $derived(id ?? `${uid}-select`);
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = $derived([hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined);

  function change(event: Event) {
    value = (event.currentTarget as HTMLSelectElement).value;
    onchange?.(value, event);
  }
</script>

<!-- Select nativo: en móvil abre el selector del sistema. Mismo borde, radio y
     altura (44) que Field. Sin talla sm: un <select> no admite el pseudo-elemento
     que amplía el área táctil a 44. -->
<div
  class="ui-select {className}"
  class:ui-select--inline={inline}
  class:ui-select--icon={!!icon}
  class:ui-select--icon-wide={!!icon && !compactIcon}
  class:ui-select--disabled={disabled}
  class:ui-select--error={!!error}
>
  <label
    class="ui-select__label"
    class:sr-only={hideLabel === true}
    class:ui-select__label--compact={hideLabel === 'compact'}
    class:ui-select__label--wide={hideLabel === 'wide'}
    for={selectId}>{label}</label
  >
  <div class="ui-select__control">
    {#if icon}<span class="ui-select__icon"><Icon name={icon} size="sm" /></span>{/if}
    <select bind:this={element} class="ui-select__input" id={selectId} {name} {disabled} {value} onchange={change} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...rest}>
      {#each options as option (option.value)}
        <option value={option.value} disabled={option.disabled}>{option.label}</option>
      {/each}
    </select>
    <span class="ui-select__chevron"><Icon name="chevron-abajo" size="sm" /></span>
  </div>
  {#if hint}<p class="ui-select__hint" id={hintId}>{hint}</p>{/if}
  {#if error}<p class="ui-select__error" id={errorId}>{error}</p>{/if}
</div>

<style>
  .ui-select {
    --select-h: var(--field-h-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  .ui-select--inline { flex-direction: row; align-items: center; gap: var(--space-2); }

  .ui-select__label {
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
  }
  .ui-select--inline .ui-select__label { color: var(--color-texto-medio); font-size: var(--control-font-size); font-weight: 500; }

  .ui-select__control { position: relative; display: flex; align-items: center; min-width: 0; }
  .ui-select--error .ui-select__input { border-color: var(--color-danger); }
  .ui-select__hint,
  .ui-select__error { margin: 0; font-size: var(--text-2xs); line-height: 1.45; }
  .ui-select__hint { color: var(--color-texto-tenue); }
  .ui-select__error { color: var(--color-danger-texto); font-weight: 600; }

  .ui-select__input {
    width: 100%;
    min-width: 0;
    height: var(--select-h);
    box-sizing: border-box;
    padding: 0 calc(var(--space-2) + var(--icon-sm) + var(--space-1)) 0 var(--space-3);
    border: 1px solid var(--color-linea-fuerte);
    border-radius: var(--control-radius);
    background: var(--color-superficie-1);
    color: var(--color-texto);
    font-family: var(--font-ui);
    font-size: var(--control-font-size);
    font-weight: 600;
    line-height: 1;
    text-overflow: ellipsis;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    transition: border-color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard);
  }
  .ui-select--icon .ui-select__input { padding-left: calc(var(--space-3) + var(--icon-sm) + var(--space-1)); }
  /* El menú nativo hereda el fondo de la página, no el velo translúcido. */
  .ui-select__input option { background: var(--color-panel); color: var(--color-texto); }

  .ui-select__input:hover:not(:disabled) { border-color: var(--color-acento-border); }
  .ui-select__input:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
    border-color: var(--color-acento-border);
    box-shadow: var(--focus-ring);
  }
  .ui-select__input:disabled { border-color: var(--color-linea-sutil); color: var(--color-texto-desactivado); cursor: not-allowed; }

  .ui-select__icon,
  .ui-select__chevron {
    position: absolute;
    display: flex;
    color: var(--color-texto-tenue);
    pointer-events: none;
  }
  .ui-select__icon { left: var(--space-3); }
  .ui-select__chevron { right: var(--space-2); }
  .ui-select__control:focus-within .ui-select__icon,
  .ui-select__control:focus-within .ui-select__chevron { color: var(--color-acento); }

  @media (max-width: 479px) {
    .ui-select--icon-wide .ui-select__icon { display: none; }
    .ui-select--icon-wide .ui-select__input { padding-left: var(--space-3); }
    .ui-select__label--compact {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  }
  @media (max-width: 1023px) {
    .ui-select__label--wide {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  }
</style>
