<script lang="ts">
  import Icon from './Icon.svelte';

  type Props = {
    /**
     * filter: filtro activo compacto; todo el chip quita el filtro.
     * genre: género (texto, enlace o botón).
     * status: estado, solo lectura.
     */
    kind: 'filter' | 'genre' | 'status';
    label: string;
    /** status: color del estado. */
    tone?: 'neutral' | 'accent' | 'warning' | 'danger';
    /** genre: lo convierte en enlace (con `onclick`, para navegar con goto). */
    href?: string;
    /** genre: lo convierte en botón. */
    onclick?: (event: MouseEvent) => void;
    /** filter: acción de quitar. */
    onremove?: (event: MouseEvent) => void;
    /** filter: nombre accesible. Por defecto "Quitar filtro: {label}". */
    removeLabel?: string;
    /** genre activo dentro de un grupo (aria-pressed). */
    selected?: boolean;
    /**
     * genre interactivo: md (32, por defecto) o sm (24) para una sola línea de
     * géneros en un contexto denso (tarjeta, fila). sm conserva el área táctil
     * de 44 con su ::after.
     */
    size?: 'sm' | 'md';
    disabled?: boolean;
    class?: string;
    [attribute: string]: unknown;
  };

  let {
    kind,
    label,
    tone = 'neutral',
    href,
    onclick,
    onremove,
    removeLabel,
    selected,
    size = 'md',
    disabled = false,
    class: className = '',
    ...rest
  }: Props = $props();

  const classes = $derived(
    ['ui-chip', `ui-chip--${kind}`, kind === 'status' && `ui-chip--${tone}`, size === 'sm' && 'ui-chip--sm', className].filter(Boolean).join(' ')
  );
</script>

{#if kind === 'filter'}
  <button
    type="button"
    class={classes}
    aria-label={removeLabel ?? `Quitar filtro: ${label}`}
    {disabled}
    onclick={onremove}
    {...rest}
  >
    <span class="ui-chip__label">{label}</span>
    <Icon name="cerrar" size="sm" class="ui-chip__remove" />
  </button>
{:else if kind === 'genre' && href !== undefined}
  <a class={classes} {href} aria-current={selected ? 'true' : undefined} {onclick} {...rest}><span class="ui-chip__label">{label}</span></a>
{:else if kind === 'genre' && onclick}
  <button type="button" class={classes} aria-pressed={selected} {disabled} {onclick} {...rest}>
    <span class="ui-chip__label">{label}</span>
  </button>
{:else}
  <span class={classes} {...rest}><span class="ui-chip__label">{label}</span></span>
{/if}

<style>
  .ui-chip {
    --chip-h: var(--chip-h-sm);
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 100%;
    min-height: var(--chip-h);
    box-sizing: border-box;
    padding: 0 var(--chip-px-sm);
    border: 1px solid var(--color-linea);
    border-radius: var(--radius-pill);
    background: var(--color-superficie-1);
    color: var(--color-texto-alto);
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    flex: none;
  }

  .ui-chip__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

  /* Interactivos: área táctil de 44 sin cambiar la caja visible. */
  button.ui-chip,
  a.ui-chip { cursor: pointer; transition: border-color var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard); }
  button.ui-chip::after,
  a.ui-chip::after {
    content: '';
    position: absolute;
    inset-block: min(0px, calc((100% - var(--target-touch)) / 2));
    inset-inline: min(0px, calc((100% - var(--target-touch)) / 2));
  }
  button.ui-chip:focus-visible,
  a.ui-chip:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
    box-shadow: var(--focus-ring);
  }
  /* Un género interactivo mide 32: con 12 de separación entre filas, cada objetivo
     llega a 44 sin solapar el de la fila siguiente. */
  a.ui-chip--genre,
  button.ui-chip--genre { --chip-h: var(--chip-h-md); padding: 0 var(--chip-px-md); }
  /* En una sola línea (tarjeta, fila) no hay fila siguiente que solapar: 24 visibles. */
  a.ui-chip--genre.ui-chip--sm,
  button.ui-chip--genre.ui-chip--sm { --chip-h: var(--chip-h-sm); padding: 0 var(--chip-px-sm); }
  button.ui-chip:disabled { cursor: not-allowed; color: var(--color-texto-desactivado); border-color: var(--color-linea-sutil); }

  /* ---- Filtro activo compacto ---- */
  .ui-chip--filter {
    --chip-h: var(--chip-h-md);
    padding: 0 var(--space-2) 0 var(--chip-px-md);
    border-color: var(--color-acento-border);
    background: var(--color-acento-dim);
    color: var(--color-acento);
    font-size: var(--text-xs);
    font-weight: 700;
  }
  .ui-chip--filter:hover:not(:disabled) { border-color: var(--color-acento); background: var(--color-acento-suave); }
  .ui-chip--filter :global(.ui-chip__remove) { opacity: .72; }
  .ui-chip--filter:hover :global(.ui-chip__remove) { opacity: 1; }

  /* ---- Género ---- */
  .ui-chip--genre { border-color: var(--color-acento-border); background: transparent; color: var(--color-acento-texto); }
  a.ui-chip--genre:hover,
  button.ui-chip--genre:hover:not(:disabled) { border-color: var(--color-acento); color: var(--color-acento); background: var(--color-acento-tinte); }
  .ui-chip--genre[aria-pressed='true'],
  .ui-chip--genre[aria-current='true'] { background: var(--color-acento-dim); border-color: var(--color-acento); color: var(--color-acento); }

  /* ---- Estado ---- */
  .ui-chip--status { border-radius: var(--radius-xs); text-transform: uppercase; letter-spacing: var(--nav-letter-spacing); font-weight: 700; }
  .ui-chip--neutral { color: var(--color-texto-medio); }
  .ui-chip--accent { border-color: var(--color-acento-border); background: var(--color-acento-dim); color: var(--color-acento); }
  .ui-chip--warning { border-color: var(--color-aviso-borde); background: var(--color-aviso-dim); color: var(--color-aviso); }
  .ui-chip--danger { border-color: var(--color-danger-borde); background: var(--color-danger-dim); color: var(--color-danger-texto); }
</style>
