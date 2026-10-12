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
     * la barra lateral. Por debajo de 1024 no se muestran: la sección ofrece un selector.
     */
    items?: ToolSection[];
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import ToolHeader from './ToolHeader.svelte';

  type Props = {
    /** Nombre de la herramienta, en la barra lateral ("Estudio"). */
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
    /** Acciones de la vista, a la derecha del título. */
    actions?: Snippet;
    /** Pie de la barra lateral (volver al sitio, cuenta). */
    sidebarFooter?: Snippet;
    children?: Snippet;
    class?: string;
  };

  let { name, sections, current, title, actions, sidebarFooter, children, class: className = '' }: Props = $props();

  const holdsCurrent = (section: ToolSection) => section.items?.some((item) => item.href === current) ?? false;
</script>

<!-- Densidad compacta y ancho completo: el lenguaje del Estudio (U15). -->
<div class="l-container l-container--full l-tool {className}" data-density="compact">
  <aside class="l-tool__sidebar">
    <p class="l-tool__name">{name}</p>
    <nav class="l-tool__nav" aria-label={name}>
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
              {#if section.count}<span class="l-tool__count">{section.count.toLocaleString('es-CO')}</span>{/if}
            </a>
            {#if section.items?.length}
              <ul class="l-tool__items" aria-label={section.label}>
                {#each section.items as item}
                  <li>
                    <a class="l-tool__link l-tool__link--item" href={item.href} aria-current={item.href === current ? 'page' : undefined}>
                      <span class="l-tool__label">{item.label}</span>
                      {#if item.count !== undefined}<span class="l-tool__tally">{item.count.toLocaleString('es-CO')}</span>{/if}
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
  </aside>

  <div class="l-tool__main">
    {#if title}<ToolHeader {title} {actions} />{/if}
    {@render children?.()}
  </div>
</div>

<style>
  .l-tool {
    display: grid;
    grid-template-columns: var(--tool-sidebar-w) minmax(0, 1fr);
    gap: var(--space-6);
    padding-top: var(--space-5);
    padding-bottom: var(--page-pad-bottom);
  }

  .l-tool__sidebar {
    position: sticky;
    top: calc(var(--header-offset) + var(--space-5));
    transition: top var(--motion-slow) var(--ease-emphasized);
    align-self: start;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .l-tool__name {
    margin: 0;
    padding: 0 var(--space-3);
    color: var(--color-texto-tenue);
    font-size: var(--density-label);
    font-weight: var(--nav-font-weight);
    letter-spacing: var(--nav-letter-spacing);
    text-transform: uppercase;
  }

  .l-tool__nav ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .l-tool__link {
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
  .l-tool__link:hover { background: var(--color-superficie-2); color: var(--color-texto); }
  .l-tool__link[aria-current='page'] { background: var(--color-acento-dim); color: var(--color-acento); }
  /* La sección cuya vista está abierta: su nombre se destaca sin fondo. */
  .l-tool__link--open { color: var(--color-texto); }
  .l-tool__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .l-tool__count {
    min-width: var(--chip-h-sm);
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-3);
    color: var(--color-texto);
    font-size: var(--text-2xs);
    line-height: var(--chip-h-sm);
    text-align: center;
  }

  /* Vistas de una sección: sangradas a la altura del nombre (icono sm + hueco),
     con una guía vertical y su tamaño en cifras tabulares, sin cápsula. */
  .l-tool__nav .l-tool__items {
    gap: 0;
    margin: var(--space-1) 0 var(--space-2) calc(var(--space-3) + var(--icon-sm) / 2);
    padding-left: calc(var(--space-3) + var(--icon-sm) / 2 - 1px);
    border-left: 1px solid var(--color-linea);
  }
  .l-tool__link--item { padding-inline: var(--space-3); font-weight: 500; }
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

  .l-tool__main { min-width: 0; }

  /* Móvil y tablet (U15): la barra lateral pasa a una fila de secciones
     desplazable, para dejar el ancho a la tabla. */
  @media (prefers-reduced-motion: reduce) {
    .l-tool__sidebar { transition: none; }
  }

  @media (max-width: 1023px) {
    .l-tool {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
      padding-top: var(--space-3);
    }
    .l-tool__sidebar { position: static; }
    .l-tool__name { display: none; }
    .l-tool__nav { overflow-x: auto; margin-inline: calc(-1 * var(--container-gutter)); padding-inline: var(--container-gutter); }
    .l-tool__nav ul { flex-direction: row; }
    .l-tool__nav .l-tool__items { display: none; }
    .l-tool__link--open { background: var(--color-acento-dim); color: var(--color-acento); }
    .l-tool__sidebar-footer { display: none; }
  }
</style>
