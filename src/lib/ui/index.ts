/**
 * Primitivas del sistema de interfaz: base (U5) y compuestas (U6). Catálogo
 * vivo en /lab. API de cada una:
 * docs/modernizacion/u5-primitivas-base-2026-10-07.md y
 * docs/modernizacion/u6-primitivas-compuestas-2026-10-07.md
 */
export { default as Icon } from './Icon.svelte';
export { default as Button } from './Button.svelte';
export { default as IconButton } from './IconButton.svelte';
export { default as Field } from './Field.svelte';
export { default as Select, type SelectOption } from './Select.svelte';
export { default as Textarea } from './Textarea.svelte';
export { default as PasswordField } from './PasswordField.svelte';
export { default as Checkbox } from './Checkbox.svelte';
export { default as Notice } from './Notice.svelte';
export { default as Chip } from './Chip.svelte';
export { default as Pagination } from './Pagination.svelte';
export { default as ViewToggle } from './ViewToggle.svelte';
export { default as Skeleton } from './Skeleton.svelte';
export { default as LoadingIndicator } from './LoadingIndicator.svelte';
export { default as EmptyState } from './EmptyState.svelte';
export { default as ErrorState } from './ErrorState.svelte';
export { default as Breadcrumbs } from './Breadcrumbs.svelte';
export { default as Combobox } from './Combobox.svelte';
export { default as Menu, type MenuItem, type MenuGroup } from './Menu.svelte';
export { default as Dialog } from './Dialog.svelte';
export { default as Sheet } from './Sheet.svelte';
export { default as Sortable } from './Sortable.svelte';
export { default as Cover } from './Cover.svelte';
export { default as CreditLine } from './CreditLine.svelte';
export { default as SocialLinks } from './SocialLinks.svelte';
export { ICONS, ICON_NAMES, SOCIAL_ICONS, type IconName } from './icons';
export { paginationItems, clampPage, type PaginationItem } from './pagination';
export { readViewPreference, writeViewPreference, type ViewMode } from './viewPreference';
export { evaluatePassword, DEFAULT_PASSWORD_RULES, PASSWORD_MIN_LENGTH, type PasswordRule } from './password';
export { filterOptions, normalizeSearch, canCreate, type ComboboxOption } from './combobox';
export { moveItem, type SortableLayout } from './sortable';
export { creditRoleGroups, creditRoleLabel, type CreditRoleGroup } from './credits';
export { layerFor } from './overlay';
