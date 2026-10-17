<script lang="ts">
  import Button, { type ButtonSize } from './Button.svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  type Props = {
    icon: IconName;
    /** Nombre accesible y texto de la ayuda emergente. Obligatorio. */
    label: string;
    variant?: 'ghost' | 'secondary' | 'primary' | 'destructive';
    /** sm 32 · md 44 · lg 52, siempre cuadrado. sm amplía su área táctil a 44. */
    size?: ButtonSize;
    href?: string;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    pressed?: boolean;
    /** Dónde aparece la ayuda: arriba (por defecto) o abajo. */
    tooltip?: 'top' | 'bottom';
    /** Alineación horizontal de la ayuda, para iconos pegados a un borde. */
    tooltipAlign?: 'center' | 'start' | 'end';
    /**
     * La ayuda empieza descartada: el × que recibe el foco al abrir un diálogo
     * no tapa el contenido. Vuelve cuando el foco o el puntero salen y regresan.
     */
    quietTip?: boolean;
    class?: string;
    element?: HTMLButtonElement | HTMLAnchorElement;
    onclick?: (event: MouseEvent) => void;
    [attribute: string]: unknown;
  };

  let {
    icon,
    label,
    variant = 'ghost',
    size = 'md',
    tooltip = 'top',
    tooltipAlign = 'center',
    quietTip = false,
    class: className = '',
    element = $bindable(),
    ...rest
  }: Props = $props();

  // WCAG 1.4.13: la ayuda se puede descartar con Escape sin mover el foco ni el
  // puntero. No detiene el evento: si el botón vive en un menú o un diálogo, ese
  // Escape también les llega (overlay.ts).
  // svelte-ignore state_referenced_locally
  let dismissed = $state(quietTip);

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') dismissed = true;
  }
</script>

<span
  class="ui-icon-btn ui-icon-btn--tip-{tooltip} ui-icon-btn--align-{tooltipAlign} {className}"
  class:ui-icon-btn--dismissed={dismissed}
  role="presentation"
  onkeydown={onkeydown}
  onpointerenter={() => (dismissed = false)}
  onpointerleave={() => (dismissed = false)}
  onfocusout={() => (dismissed = false)}
>
  <Button bind:element {variant} {size} square aria-label={label} {...rest}>
    <Icon name={icon} size={size === 'sm' ? 'sm' : 'md'} />
  </Button>
  <!-- El nombre accesible ya es `label`: la ayuda visible no se repite al lector. -->
  <span class="ui-icon-btn__tip" aria-hidden="true">{label}</span>
</span>

<style>
  .ui-icon-btn {
    position: relative;
    display: inline-flex;
    flex: none;
  }

  /* Oculta con display:none para que nunca ensanche un contenedor con scroll. */
  .ui-icon-btn__tip {
    position: absolute;
    left: 50%;
    bottom: calc(100% + var(--space-2));
    z-index: var(--layer-float);
    display: none;
    width: max-content;
    max-width: var(--tooltip-max-w);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-xs);
    background: var(--color-velo-opaco);
    box-shadow: 0 4px 12px var(--color-sombra);
    color: var(--color-texto);
    font-size: var(--text-2xs);
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
    white-space: normal;
    pointer-events: none;
    transform: translateX(-50%);
  }

  .ui-icon-btn--tip-bottom .ui-icon-btn__tip { bottom: auto; top: calc(100% + var(--space-2)); }
  .ui-icon-btn--align-start .ui-icon-btn__tip { left: 0; transform: none; }
  .ui-icon-btn--align-end .ui-icon-btn__tip { left: auto; right: 0; transform: none; }

  /* Con puntero fino al pasar el cursor; con teclado al enfocar (nunca al tocar). */
  @media (hover: hover) {
    .ui-icon-btn:hover .ui-icon-btn__tip { display: block; }
  }
  .ui-icon-btn:has(:global(:focus-visible)) .ui-icon-btn__tip { display: block; }
  .ui-icon-btn--dismissed .ui-icon-btn__tip { display: none !important; }
  /* Con su menú o lista abierta (U6), la ayuda taparía el contenido que abrió. */
  .ui-icon-btn:has(:global([aria-expanded='true'])) .ui-icon-btn__tip { display: none; }
</style>
