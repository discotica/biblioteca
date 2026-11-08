<script lang="ts">
  import Button, { type ButtonSize } from './Button.svelte';
  import Menu, { type MenuGroup, type MenuItem } from './Menu.svelte';
  import type { IconName } from './icons';

  type Props = {
    /** Texto de la acción principal ("Aceptar y publicar"). */
    label: string;
    /** Acción principal. */
    onclick?: (event: MouseEvent) => void;
    /** La acción principal como enlace. */
    href?: string;
    /**
     * Nombre accesible del botón de menú y de su ayuda emergente; también nombra
     * el menú ("Más formas de aceptar"). Obligatorio: la flecha sola no dice nada.
     */
    menuLabel: string;
    /** Las otras formas de la acción. */
    items?: MenuItem[];
    groups?: MenuGroup[];
    /** primary: la acción principal de la vista (la única verde) · secondary: borde. */
    variant?: 'primary' | 'secondary';
    /** md sigue la densidad: 44, o 36 en el Estudio. */
    size?: ButtonSize;
    icon?: IconName;
    type?: 'button' | 'submit';
    /** Deshabilita las dos partes. */
    disabled?: boolean;
    /** Solo la acción principal queda ocupada; el menú se deshabilita mientras tanto. */
    loading?: boolean;
    open?: boolean;
    class?: string;
    [attribute: string]: unknown;
  };

  let {
    label,
    onclick,
    href,
    menuLabel,
    items = [],
    groups,
    variant = 'primary',
    size = 'md',
    icon,
    type = 'button',
    disabled = false,
    loading = false,
    open = $bindable(false),
    class: className = '',
    ...rest
  }: Props = $props();
</script>

<!-- Acción principal + menú (U20). El menú es Menu: Enter o Espacio lo abren,
     ↓ y ↑ abren en el primero o el último y recorren, Escape y Tab cierran y
     devuelven el foco a la flecha. Las dos partes son botones del orden de Tab. -->
<span class="ui-split ui-split--{variant} {className}">
  <Button class="ui-split__main" {variant} {size} {href} {type} {icon} {disabled} {loading} {onclick} {...rest}>{label}</Button>
  <Menu
    class="ui-split__menu"
    icon="chevron-abajo"
    label={menuLabel}
    {variant}
    {size}
    {items}
    {groups}
    align="end"
    disabled={disabled || loading}
    bind:open
  />
</span>

<style>
  .ui-split { display: inline-flex; flex: none; align-items: stretch; }

  /* Las dos mitades se tocan: la principal sin radio a la derecha, la flecha sin
     radio a la izquierda y más estrecha que un cuadrado. */
  .ui-split :global(.ui-split__main) { border-top-right-radius: 0; border-bottom-right-radius: 0; }
  .ui-split :global(.ui-split__menu .ui-btn) {
    width: auto;
    padding-inline: var(--space-2);
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  /* Primario: una línea oscura separa las mitades, sobre el verde. */
  .ui-split--primary :global(.ui-split__menu .ui-btn) { box-shadow: inset 1px 0 0 var(--color-velo); }
  .ui-split--primary :global(.ui-split__menu .ui-btn:focus-visible) { box-shadow: var(--focus-ring); }
  /* Secundario: un solo borde entre las dos. */
  .ui-split--secondary :global(.ui-split__menu .ui-btn) { margin-left: -1px; }

  /* El foco o el hover de una mitad se dibuja encima de la otra. */
  .ui-split :global(.ui-btn:focus-visible),
  .ui-split :global(.ui-btn:hover) { position: relative; z-index: var(--layer-raised); }
</style>
