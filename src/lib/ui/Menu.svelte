<script module lang="ts">
  import type { IconName } from './icons';

  export type MenuItem = {
    label: string;
    icon?: IconName;
    /** Enlace: navega y cierra. */
    href?: string;
    /** Acción: se llama después de cerrar el menú, con el foco ya en el disparador. */
    onselect?: () => void;
    /** danger: acciones destructivas (eliminar, archivar). */
    tone?: 'default' | 'danger';
    /** Sin href ni onselect, el elemento se muestra deshabilitado. */
    disabled?: boolean;
  };

  export type MenuGroup = {
    /** Encabezado visible del grupo y nombre del role="group". */
    label?: string;
    /**
     * buttons (U28): los elementos se dibujan como botones apilados, el primero
     * lleno y el resto con borde (Entrar y Crear cuenta en el panel). Siguen
     * siendo menuitem: el teclado los recorre igual.
     */
    appearance?: 'list' | 'buttons';
    items: MenuItem[];
  };
</script>

<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import Button, { type ButtonSize, type ButtonVariant } from './Button.svelte';
  import Icon from './Icon.svelte';
  import IconButton from './IconButton.svelte';
  import { anchoredLayer, dropdownMenu, layerFor, type AnchoredLayerOptions } from './overlay';

  type Props = {
    /** Elementos sin grupos. Usa `groups` para secciones con encabezado. */
    items?: MenuItem[];
    groups?: MenuGroup[];
    /**
     * Nombre accesible del menú y, con icono solo, del disparador y su ayuda
     * ("Más opciones" por defecto). Con `buttonLabel`, el texto visible nombra al
     * disparador y `label` solo al menú.
     */
    label?: string;
    /** Icono del disparador cuando no hay `buttonLabel`. */
    icon?: IconName;
    /** Disparador con texto (y chevron) en lugar de icono solo. */
    buttonLabel?: string;
    /**
     * Contenido visual propio del disparador (el avatar de la cuenta, U7), con
     * chevron. El nombre accesible sale de `label`.
     */
    trigger?: Snippet;
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Alineación del menú con el disparador. "end" para un "…" pegado a la derecha. */
    align?: 'start' | 'end';
    /** Dónde sale la ayuda del disparador de icono solo. "bottom" en el cabecero. */
    tooltip?: 'top' | 'bottom';
    /**
     * panel (U28, panel de cuenta): 320 de ancho, opaco, grupos con encabezado
     * en minúscula y sin separadores, iconos de 18 y chevron que gira al abrir.
     */
    presentation?: 'popover' | 'panel';
    /**
     * A pantalla (panel en móvil): ocupa el viewport bajo el cabecero
     * (--header-offset) en lugar de anclarse al disparador.
     */
    fullscreen?: boolean;
    /** Contenido fijo sobre los grupos (la cenefa de la cuenta). No recibe foco. */
    header?: Snippet;
    /** Distancia al disparador y a los bordes (8 por defecto, anchoredLayer). */
    gutter?: number;
    disabled?: boolean;
    open?: boolean;
    class?: string;
  };

  let {
    items = [],
    groups,
    label,
    icon = 'mas-opciones',
    buttonLabel,
    trigger: triggerContent,
    variant = 'ghost',
    size = 'md',
    align = 'end',
    tooltip = 'top',
    presentation = 'popover',
    fullscreen = false,
    header,
    gutter,
    disabled = false,
    open = $bindable(false),
    class: className = ''
  }: Props = $props();

  const id = $props.id();
  const menuId = `${id}-menu`;

  let trigger = $state<HTMLButtonElement | HTMLAnchorElement>();
  let menu = $state<HTMLElement>();
  /** Qué elemento recibe el foco al abrir: ↑ abre en el último (APG). */
  let openAt = $state<'first' | 'last'>('first');

  const name = $derived(label ?? buttonLabel ?? 'Más opciones');
  const sections = $derived<MenuGroup[]>(groups ?? [{ items }]);
  const flat = $derived(sections.flatMap((section) => section.items));
  const initialIndex = $derived.by(() => {
    const enabled = flat.map((item, index) => (isEnabled(item) ? index : -1)).filter((index) => index >= 0);
    return (openAt === 'last' ? enabled.at(-1) : enabled[0]) ?? -1;
  });

  /**
   * Coloca el menú en el portal: anclado al disparador (anchoredLayer) o, a
   * pantalla, en <body> y a todo el ancho bajo el cabecero (lo resuelve el
   * CSS). La capa de página (--layer-dropdown) queda bajo las barras sticky, y
   * el panel a pantalla debe taparlas, como el cabecero.
   */
  function place(node: HTMLElement, initial: AnchoredLayerOptions & { fullscreen: boolean }) {
    let anchored: ReturnType<typeof anchoredLayer> | undefined;
    const apply = (options: AnchoredLayerOptions & { fullscreen: boolean }) => {
      if (!options.fullscreen) {
        if (anchored) anchored.update(options);
        else anchored = anchoredLayer(node, options);
        return;
      }
      anchored?.destroy();
      anchored = undefined;
      for (const key of ['left', 'top', 'width', 'minWidth', 'maxWidth', 'maxHeight', 'overflowY'] as const) node.style[key] = '';
      if (node.parentElement !== document.body) document.body.appendChild(node);
    };
    apply(initial);
    return {
      update: apply,
      destroy: () => anchored?.destroy()
    };
  }

  function isEnabled(item: MenuItem) {
    return !item.disabled && Boolean(item.href || item.onselect);
  }

  function toggle() {
    if (disabled) return;
    openAt = 'first';
    open = !open;
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (disabled || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    openAt = event.key === 'ArrowUp' ? 'last' : 'first';
    if (!open) {
      open = true;
      return;
    }
    // Ya abierto (el foco aún no había entrado): lleva el foco al extremo pedido.
    const entries = menuItems();
    (openAt === 'last' ? entries.at(-1) : entries[0])?.focus();
  }

  function close() {
    open = false;
  }

  async function select(item: MenuItem, event: MouseEvent) {
    if (!isEnabled(item)) {
      event.preventDefault();
      return;
    }
    close();
    if (item.onselect) {
      // El menú se desmonta y devuelve el foco al disparador antes de la acción:
      // si la acción abre un diálogo, ese diálogo devolverá el foco al "…".
      await tick();
      item.onselect();
    }
  }

  function menuItems() {
    // Los deshabilitados también se recorren (APG): se leen, pero no se activan.
    return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function onMenuKeydown(event: KeyboardEvent) {
    const entries = menuItems();
    if (!entries.length) return;
    const current = entries.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (current + 1) % entries.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + entries.length) % entries.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = entries.length - 1;
    else if (event.key === ' ' && document.activeElement instanceof HTMLAnchorElement) {
      // Espacio no activa un enlace por sí solo; en un menú sí debe hacerlo.
      event.preventDefault();
      document.activeElement.click();
      return;
    } else if (event.key.length === 1 && /\S/.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) {
      // Primera letra: salta al siguiente elemento que empieza por ella.
      const letter = event.key.toLocaleLowerCase('es');
      const order = [...entries.slice(current + 1), ...entries.slice(0, current + 1)];
      const match = order.find((entry) => entry.textContent?.trim().toLocaleLowerCase('es').startsWith(letter));
      if (match) next = entries.indexOf(match);
    }
    if (next === null) return;
    event.preventDefault();
    entries[next].focus();
  }
</script>

<span class="ui-menu {className}" class:ui-menu--panel={presentation === 'panel'}>
  {#if triggerContent}
    <Button
      bind:element={trigger}
      {variant}
      {size}
      {disabled}
      class="ui-menu__trigger"
      iconEnd="chevron-abajo"
      aria-label={name}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onclick={toggle}
      onkeydown={onTriggerKeydown}
    >
      {@render triggerContent()}
    </Button>
  {:else if buttonLabel}
    <Button
      bind:element={trigger}
      {variant}
      {size}
      {disabled}
      class="ui-menu__trigger"
      iconEnd="chevron-abajo"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onclick={toggle}
      onkeydown={onTriggerKeydown}
    >
      {buttonLabel}
    </Button>
  {:else}
    <IconButton
      bind:element={trigger}
      {icon}
      label={name}
      variant={variant === 'link' ? 'ghost' : variant}
      {size}
      {disabled}
      {tooltip}
      tooltipAlign={align === 'end' ? 'end' : 'start'}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onclick={toggle}
      onkeydown={onTriggerKeydown}
    />
  {/if}

  {#if open && trigger}
    <div
      bind:this={menu}
      class="ui-menu__popup"
      class:ui-menu__popup--panel={presentation === 'panel'}
      class:ui-menu__popup--screen={fullscreen}
      id={menuId}
      role="menu"
      aria-label={name}
      tabindex="-1"
      onkeydown={onMenuKeydown}
      use:place={{ target: layerFor(trigger), trigger, align, gutter, fullscreen }}
      use:dropdownMenu={{ onClose: close, trigger, tabCloses: true, initialFocus: '[data-menu-initial]' }}
    >
      {#if header}<div class="ui-menu__header">{@render header()}</div>{/if}
      {#each sections as section, sectionIndex}
        {@const offset = sections.slice(0, sectionIndex).reduce((sum, previous) => sum + previous.items.length, 0)}
        <!-- En el panel, el encabezado de cada grupo ya los separa. -->
        {#if sectionIndex > 0 && presentation !== 'panel'}<div class="ui-menu__separator" role="separator"></div>{/if}
        <div
          class="ui-menu__group"
          class:ui-menu__group--buttons={section.appearance === 'buttons'}
          role={section.label ? 'group' : 'none'}
          aria-label={section.label}
        >
          {#if section.label}<span class="ui-menu__group-label" aria-hidden="true">{section.label}</span>{/if}
          {#each section.items as item, itemIndex}
            {@const index = offset + itemIndex}
            {@const enabled = isEnabled(item)}
            {#if item.href && enabled}
              <a
                class="ui-menu__item"
                class:ui-menu__item--danger={item.tone === 'danger'}
                class:ui-menu__item--lead={section.appearance === 'buttons' && itemIndex === 0}
                role="menuitem"
                tabindex="-1"
                href={item.href}
                data-menu-initial={index === initialIndex ? '' : undefined}
                onclick={(event) => select(item, event)}
              >
                {#if item.icon}<Icon name={item.icon} size="sm" />{/if}
                <span class="ui-menu__label">{item.label}</span>
              </a>
            {:else}
              <button
                type="button"
                class="ui-menu__item"
                class:ui-menu__item--danger={item.tone === 'danger'}
                class:ui-menu__item--lead={section.appearance === 'buttons' && itemIndex === 0}
                role="menuitem"
                tabindex="-1"
                aria-disabled={enabled ? undefined : 'true'}
                data-menu-initial={index === initialIndex ? '' : undefined}
                onclick={(event) => select(item, event)}
              >
                {#if item.icon}<Icon name={item.icon} size="sm" />{/if}
                <span class="ui-menu__label">{item.label}</span>
              </button>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</span>

<style>
  .ui-menu { display: inline-flex; flex: none; }

  /* Vive en el portal (layerFor): ningún contenedor con overflow lo recorta. */
  .ui-menu__popup {
    position: absolute;
    top: 0;
    left: 0;
    min-width: var(--menu-min-w);
    max-width: var(--menu-max-w);
    box-sizing: border-box;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-1);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-base);
    background: var(--color-panel-raised);
    box-shadow: var(--shadow-flotante);
    outline: none;
    animation: ui-menu-in var(--motion-fast) var(--ease-standard);
  }

  .ui-menu__group-label {
    display: block;
    padding: var(--space-2) var(--space-3) var(--space-1);
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-weight: 700;
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }

  .ui-menu__separator { height: 1px; margin: var(--space-1) var(--space-2); background: var(--color-linea); }

  .ui-menu__item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--target-touch);
    box-sizing: border-box;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-texto);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  .ui-menu__label { min-width: 0; overflow-wrap: anywhere; }
  .ui-menu__item:hover,
  .ui-menu__item:focus-visible { background: var(--color-superficie-2); outline: none; }
  .ui-menu__item:focus-visible { box-shadow: inset 0 0 0 2px var(--focus-ring-color); }
  .ui-menu__item--danger { color: var(--color-danger-texto); }
  .ui-menu__item--danger:hover,
  .ui-menu__item--danger:focus-visible { background: var(--color-danger-dim); }
  .ui-menu__item[aria-disabled='true'] { color: var(--color-texto-tenue); cursor: default; }
  .ui-menu__item[aria-disabled='true']:hover { background: transparent; }

  /* ---- Panel (U28, tablero J) ---- */
  .ui-menu__popup--panel {
    min-width: var(--menu-panel-w);
    padding: var(--space-2);
    border-color: var(--color-linea-panel);
    border-radius: var(--menu-panel-radius);
    background: var(--color-panel);
  }
  .ui-menu__popup--panel .ui-menu__header { margin-bottom: var(--space-1); }
  .ui-menu__popup--panel .ui-menu__group-label {
    padding: var(--space-3) var(--space-3) var(--space-1);
    font-size: var(--text-2xs);
    font-weight: 600;
    line-height: 1.333;
    letter-spacing: 0;
    text-transform: none;
  }
  .ui-menu__popup--panel .ui-menu__item :global(.ui-icon) { width: var(--icon-nav); height: var(--icon-nav); }

  /* A pantalla: bajo el cabecero, hasta el borde inferior; el contenido se
     alinea con el del cabecero (margen del contenedor menos el de la fila). */
  .ui-menu__popup--screen {
    position: fixed;
    z-index: calc(var(--layer-overlay) - 1);
    inset: var(--header-offset) 0 0 0;
    width: auto;
    min-width: 0;
    max-width: none;
    padding: var(--space-2) calc(var(--container-gutter) - var(--space-3)) var(--space-6);
    border-width: 0;
    border-radius: 0;
    box-shadow: none;
    pointer-events: auto;
  }

  /* Elementos como botones apilados (Entrar y Crear cuenta). */
  .ui-menu__group--buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-1);
  }
  .ui-menu__group--buttons .ui-menu__item {
    justify-content: center;
    min-height: var(--control-h-md);
    border: 1px solid var(--color-linea-fuerte);
    border-radius: var(--control-radius);
    font-weight: var(--button-font-weight);
  }
  .ui-menu__group--buttons .ui-menu__item:hover,
  .ui-menu__group--buttons .ui-menu__item:focus-visible { border-color: var(--color-acento-border); background: var(--color-acento-tinte); }
  .ui-menu__group--buttons .ui-menu__item--lead {
    border-color: var(--color-acento);
    background: var(--color-acento);
    color: var(--color-sobre-acento);
  }
  .ui-menu__group--buttons .ui-menu__item--lead:hover,
  .ui-menu__group--buttons .ui-menu__item--lead:focus-visible { border-color: var(--color-acento-hover); background: var(--color-acento-hover); }

  /* El chevron del disparador apunta hacia el panel abierto. */
  .ui-menu--panel :global(.ui-menu__trigger > .ui-icon:last-child) { transition: transform var(--motion-fast) var(--ease-standard); }
  .ui-menu--panel :global(.ui-menu__trigger[aria-expanded='true'] > .ui-icon:last-child) { transform: rotate(180deg); }

  @keyframes ui-menu-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ui-menu__popup { animation: none; }
    .ui-menu--panel :global(.ui-menu__trigger > .ui-icon:last-child) { transition: none; }
  }
</style>
