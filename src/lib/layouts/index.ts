/**
 * Shell y layouts (U7). Cada ruta declara aquí su layout y su contenedor; ninguna
 * define su propio ancho, título o botón de volver. API y mapa de rutas:
 * docs/modernizacion/u7-shell-layouts-2026-10-07.md
 */
export { default as Container, type ContainerSize } from './Container.svelte';
export { default as PageLayout } from './PageLayout.svelte';
export { default as AccountLayout } from './AccountLayout.svelte';
export { default as ReadingLayout, type TocEntry } from './ReadingLayout.svelte';
export { default as ToolLayout, type ToolSection } from './ToolLayout.svelte';
export { default as ToolHeader } from './ToolHeader.svelte';
export { catalogCrumb } from './crumbs';
// Bandeja del Estudio (U17): lista + detalle de Propuestas y Reportes.
export { default as InboxLayout, type InboxGroup } from './InboxLayout.svelte';
export { default as InboxItem } from './InboxItem.svelte';
export { default as InboxDetail } from './InboxDetail.svelte';
export { default as InboxField } from './InboxField.svelte';
