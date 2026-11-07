<script module lang="ts">
  import type { IconName } from '$lib/ui/icons';

  export type ToolSection = {
    label: string;
    href: string;
    icon?: IconName;
    /** Pendientes de la sección (propuestas, reportes) o tamaño de una vista. */
    count?: number;
    /**
     * Vistas de la sección (U15: las vistas rápidas del Catálogo), bajo ella en
     * la barra lateral. Por debajo de 1024 no se muestran: la sección ofrece un
     * selector. Con la barra plegada tampoco: queda la sección.
     */
    items?: ToolSection[];
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import IconButton from '$lib/ui/IconButton.svelte';
  import ToolHeader from './ToolHeader.svelte';
  import { readToolSidebarCollapsed, writeToolSidebarCollapsed, TOOL_SIDEBAR_KEY } from './toolSidebar';

  type Props = {
    /** Nombre de la herramienta ("Estudio"): nombre accesible de la barra lateral. No se muestra (U20). */
    name: string;
    /** Secciones de la barra lateral. */
    sections: ToolSection[];
    /** href actual (aria-current="page"), de una sección o de una de sus vistas. */
    current?: string;
    /**
     * Título de la vista (h1), sobre el contenido. Si el layout vive en un
     * +layout.svelte, cada vista pone su propio ToolHeader.
     */
    title?: string;
    /** Conteo junto al título (ToolHeader). */
    count?: number;
    /** Acciones de la vista, a la derecha del título. */
    actions?: Snippet;
    /** Pie de la barra lateral (volver al sitio, cuenta). Se oculta con la barra plegada. */
    sidebarFooter?: Snippet;
    /**
     * Barra plegada a iconos (U20, solo desde 1024). Sin valor, se lee la
     * preferencia guardada; si no hay o falla, desplegada.
     */
    collapsed?: boolean;
    /** Guarda la preferencia en localStorage al plegar o desplegar. false en /lab. */
    persist?: boolean;
    children?: Snippet;
    class?: string;
  };

  let {
    name,
    sections,
    current,
    title,
    count,
    actions,
    sidebarFooter,
    collapsed = $bindable(),
    persist = true,
    children,
    class: className = ''
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  if (collapsed === undefined) collapsed = persist ? readToolSidebarCollapsed(undefined, TOOL_SIDEBAR_KEY) : false;

  const navId = $props.id();
  const holdsCurrent = (section: ToolSection) => section.items?.some((item) => item.href === current) ?? false;
  const format = (value: number) => value.toLocaleString('es-CO');

  function toggle() {
    collapsed = !collapsed;
    if (persist) writeToolSidebarCollapsed(collapsed);
  }
</script>

<!-- Densidad compacta y ancho completo: el lenguaje del Estudio (U15). -->
<div class="l-container l-container--full l-tool {className}" class:l-tool--collapsed={collapsed} data-density="compact">
  <aside class="l-tool__sidebar">
    <div class="l-tool__rail">
      <nav class="l-tool__nav" id={navId} aria-label={name}>
        <ul>
          {#each sections as section}
            <li>
              <a
                class="l-tool__link"
                class:l-tool__link--open={holdsCurrent(section)}
                href={section.href}
                aria-current={section.href === current ? 'page' : undefined}
              >
                {#if section.icon}<Icon name={section.icon} size="sm" />{/if}
                <span class="l-tool__label">{section.label}</span>
                {#if section.count}<span class="l-tool__count">{format(section.count)}</span>{/if}{#if collapsed}<span class="l-tool__tip" aria-hidden="true">{section.label}</span>{/if}
              </a>
              {#if section.items?.length}
                <ul class="l-tool__items" aria-label={section.label}>
                  {#each section.items as item}
                    <li>
                      <a class="l-tool__link l-tool__link--item" href={item.href} aria-current={item.href === current ? 'page' : undefined}>
                        <span class="l-tool__label">{item.label}</span>
                        {#if item.count !== undefined}<span class="l-tool__tally">{format(item.count)}</span>{/if}
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
        </ul>
      </nav>
      {#if sidebarFooter}<div class="l-tool__sidebar-footer">{@render sidebarFooter()}</div>{/if}
      <div class="l-tool__toggle">
        <IconButton
          icon={collapsed ? 'barra-desplegar' : 'barra-plegar'}
          label={collapsed ? 'Desplegar la barra' : 'Plegar la barra'}
          size="sm"
          tooltipAlign="start"
          aria-controls={navId}
          onclick={toggle}
        />
      </div>
    </div>
  </aside>

  <div class="l-tool__main">
    {#if title}<ToolHeader {title} {count} {actions} />{/if}
    {@render children?.()}
  </div>
</div>

<style>
  .l-tool {
    display: grid;
    grid-template-columns: var(--tool-sidebar-w) minmax(0, 1fr);
    gap: var(--tool-gap-col);
    padding-top: var(--tool-gap-header);
    padding-bottom: var(--page-pad-bottom);
  }
  .l-tool--collapsed { grid-template-columns: var(--tool-sidebar-w-collapsed) minmax(0, 1fr); }

  /* La barra ocupa todo el alto de la fila (con su línea a la derecha); dentro,
     el riel es sticky y llega hasta abajo del viewport, así el botón de plegar
     queda abajo. En una vista más corta que el viewport, el riel mide lo que la
     fila: el porcentaje no cuenta al medir la fila, que sigue al contenido. */
  .l-tool__sidebar {
    min-width: 0;
    box-sizing: border-box;
    padding-right: var(--space-3);
    border-right: 1px solid var(--color-linea-sutil);
  }

  .l-tool__rail {
    position: sticky;
    top: calc(var(--header-offset) + var(--tool-gap-header));
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    box-sizing: border-box;
    min-height: min(calc(100dvh - var(--header-offset) - var(--tool-gap-header) * 2), 100%);
    transition: top var(--motion-slow) var(--ease-emphasized), min-height var(--motion-slow) var(--ease-emphasized);
  }

  .l-tool__nav ul {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Cada enlace ocupa 44 (área táctil) y se ven 36 de resaltado (lienzo): el
     fondo es un ::before con el sobrante arriba y abajo. Plegada son 40 × 40;
     las vistas, 32 (Plegada: el nombre es la ayuda emergente, ya es el nombre
     accesible.) */
  .l-tool__link {
    --link-visible: var(--density-control-h);
    --link-bg: transparent;
    position: relative;
    isolation: isolate;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--target-touch);
    padding: 0 var(--space-3);
    border-radius: var(--radius-sm);
    color: var(--color-texto-medio);
    font-size: var(--density-text);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  .l-tool__link::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: calc((100% - var(--link-visible)) / 2) 0;
    border-radius: inherit;
    background: var(--link-bg);
  }
  .l-tool__link:hover { --link-bg: var(--color-superficie-2); color: var(--color-texto); }
  .l-tool__link[aria-current='page'] { --link-bg: var(--color-acento-dim); color: var(--color-acento); }
  .l-tool__link:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: -2px; }
  /* La sección cuya vista está abierta: su nombre se destaca sin fondo. */
  .l-tool__link--open { color: var(--color-texto); }
  .l-tool__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  /* Pendientes de la sección: cifra de acento, sin cápsula (lienzo, tablero 1). */
  .l-tool__count {
    color: var(--color-acento);
    font-size: var(--text-2xs);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* Vistas de una sección: sangradas a la altura del nombre (icono sm + hueco),
     con una guía vertical y su tamaño en cifras tabulares, sin cápsula. */
  .l-tool__nav .l-tool__items {
    gap: 0;
    margin: var(--space-1) 0 var(--space-2) calc(var(--space-3) + var(--icon-sm) / 2);
    padding-left: calc(var(--space-3) + var(--icon-sm) / 2 - 1px);
    border-left: 1px solid var(--color-linea);
  }
  .l-tool__link--item { --link-visible: var(--control-h-sm); padding-inline: var(--space-3); font-weight: 500; }
  .l-tool__tally {
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    font-variant-numeric: tabular-nums;
  }
  .l-tool__link--item[aria-current='page'] .l-tool__tally { color: var(--color-acento); }

  .l-tool__sidebar-footer {
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-linea);
  }

  .l-tool__toggle { margin-top: auto; }

  .l-tool__tip { display: none; }

  .l-tool__main { min-width: 0; }

  /* ---- Plegada (U20): solo desde 1024; en móvil la barra es una fila. ---- */
  @media (min-width: 1024px) {
    .l-tool--collapsed .l-tool__sidebar { padding-right: var(--space-2); }
    .l-tool--collapsed .l-tool__rail { align-items: center; }
    .l-tool--collapsed .l-tool__nav ul { align-items: center; }
    .l-tool--collapsed .l-tool__link {
      --link-visible: var(--tool-nav-item);
      justify-content: center;
      width: var(--target-touch);
      padding: 0;
    }
    .l-tool--collapsed .l-tool__link::before { inset: calc((100% - var(--link-visible)) / 2); }
    .l-tool--collapsed .l-tool__label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    /* El conteo pasa a insignia sobre el icono. */
    .l-tool--collapsed .l-tool__count {
      position: absolute;
      top: calc((var(--target-touch) - var(--tool-nav-item)) / 2 + var(--space-1));
      right: calc((var(--target-touch) - var(--tool-nav-item)) / 2 + var(--space-1) / 2);
      min-width: var(--tool-badge-h);
      height: var(--tool-badge-h);
      box-sizing: border-box;
      padding: 0 var(--space-1);
      border-radius: var(--radius-pill);
      background: var(--color-acento);
      color: var(--color-sobre-acento);
      font-size: var(--text-2xs);
      font-weight: 700;
      line-height: var(--tool-badge-h);
      text-align: center;
    }
    .l-tool--collapsed .l-tool__items,
    .l-tool--collapsed .l-tool__sidebar-footer { display: none; }

    /* Ayuda emergente a la derecha del icono, como la de IconButton. */
    .l-tool--collapsed .l-tool__tip {
      position: absolute;
      top: 50%;
      left: calc(100% + var(--space-2));
      z-index: var(--layer-float);
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
      pointer-events: none;
      transform: translateY(-50%);
    }
    .l-tool--collapsed .l-tool__link:focus-visible .l-tool__tip { display: block; }
  }
  @media (min-width: 1024px) and (hover: hover) {
    .l-tool--collapsed .l-tool__link:hover .l-tool__tip { display: block; }
  }

  @media (prefers-reduced-motion: reduce) {
    .l-tool__rail { transition: none; }
  }

  /* Móvil y tablet (U15): la barra lateral pasa a una fila de secciones
     desplazable, para dejar el ancho a la tabla. Sin plegar. */
  @media (max-width: 1023px) {
    .l-tool,
    .l-tool--collapsed {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
      padding-top: var(--space-3);
    }
    .l-tool__sidebar { padding-right: 0; border-right: 0; }
    .l-tool__rail { position: static; min-height: 0; }
    .l-tool__nav { overflow-x: auto; margin-inline: calc(-1 * var(--container-gutter)); padding-inline: var(--container-gutter); }
    .l-tool__nav ul { flex-direction: row; }
    .l-tool__nav ul { gap: var(--space-1); }
    .l-tool__link { --link-visible: 100%; }
    .l-tool__nav .l-tool__items { display: none; }
    .l-tool__link--open { --link-bg: var(--color-acento-dim); color: var(--color-acento); }
    .l-tool__sidebar-footer,
    .l-tool__toggle { display: none; }
  }
</style>
