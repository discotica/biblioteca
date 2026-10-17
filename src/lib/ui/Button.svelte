<script module lang="ts">
  export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'destructive' | 'link';
  export type ButtonSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import LoadingIndicator from './LoadingIndicator.svelte';
  import type { IconName } from './icons';

  type Props = {
    /** primary (lleno) · secondary (borde) · accent (borde y texto de acento) · ghost · destructive · link */
    variant?: ButtonVariant;
    /** sm 32 · md 44 (Comprar) · lg 52. sm amplía su área táctil a 44. */
    size?: ButtonSize;
    /** Con href se renderiza como enlace con el mismo aspecto. */
    href?: string;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    /** Ocupado: conserva el ancho, muestra el indicador y no responde al clic. */
    loading?: boolean;
    icon?: IconName;
    iconEnd?: IconName;
    /** Ocupa todo el ancho disponible. */
    block?: boolean;
    /** Cuadrado, para IconButton. */
    square?: boolean;
    /** Botón de alternancia (aria-pressed). */
    pressed?: boolean;
    class?: string;
    element?: HTMLButtonElement | HTMLAnchorElement;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
    [attribute: string]: unknown;
  };

  let {
    variant = 'primary',
    size = 'md',
    href,
    type = 'button',
    disabled = false,
    loading = false,
    icon,
    iconEnd,
    block = false,
    square = false,
    pressed,
    class: className = '',
    element = $bindable(),
    onclick,
    children,
    ...rest
  }: Props = $props();

  const inactive = $derived(disabled || loading);
  const iconSize = $derived(size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md');
  const classes = $derived(
    ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, square && 'ui-btn--square', block && 'ui-btn--block', className]
      .filter(Boolean)
      .join(' ')
  );

  function handleClick(event: MouseEvent) {
    if (inactive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    onclick?.(event);
  }
</script>

{#snippet content()}
  {#if loading}
    <LoadingIndicator size="sm" decorative />
  {:else if icon}
    <Icon name={icon} size={iconSize} />
  {/if}
  <!-- Cuadrado ocupado: el indicador sustituye al icono. -->
  {#if children && !(square && loading)}<span class="ui-btn__label">{@render children()}</span>{/if}
  {#if iconEnd && !loading}<Icon name={iconEnd} size={iconSize} />{/if}
{/snippet}

{#if href !== undefined}
  <a
    bind:this={element}
    class={classes}
    href={inactive ? undefined : href}
    role={inactive ? 'link' : undefined}
    aria-disabled={inactive ? 'true' : undefined}
    aria-busy={loading ? 'true' : undefined}
    aria-pressed={pressed}
    tabindex={inactive ? -1 : undefined}
    onclick={handleClick}
    {...rest}
  >
    {@render content()}
  </a>
{:else}
  <button
    bind:this={element}
    class={classes}
    {type}
    disabled={disabled}
    aria-disabled={loading ? 'true' : undefined}
    aria-busy={loading ? 'true' : undefined}
    aria-pressed={pressed}
    onclick={handleClick}
    {...rest}
  >
    {@render content()}
  </button>
{/if}

<style>
  .ui-btn {
    --btn-h: var(--button-h-md);
    --btn-px: var(--button-px-md);
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--btn-h);
    padding: 0 var(--btn-px);
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: var(--control-radius);
    background: transparent;
    color: var(--color-texto);
    font-family: var(--font-ui);
    font-size: var(--control-font-size);
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard);
  }

  /* Área táctil mínima de 44 en los dos ejes, sin cambiar la caja visible. */
  .ui-btn::after {
    content: '';
    position: absolute;
    inset-block: min(0px, calc((100% - var(--target-touch)) / 2));
    inset-inline: min(0px, calc((100% - var(--target-touch)) / 2));
  }

  .ui-btn--sm { --btn-h: var(--button-h-sm); --btn-px: var(--button-px-sm); font-size: var(--text-xs); gap: var(--space-1); }
  .ui-btn--lg { --btn-h: var(--button-h-lg); --btn-px: var(--button-px-lg); font-size: var(--text-md); }
  .ui-btn--square { width: var(--btn-h); padding: 0; }
  .ui-btn--block { display: flex; width: 100%; }

  .ui-btn__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

  /* ---- Variantes ---- */
  .ui-btn--primary { background: var(--color-acento); color: var(--color-sobre-acento); }
  .ui-btn--primary:hover { background: var(--color-acento-hover); }

  .ui-btn--secondary { border-color: var(--color-linea-fuerte); color: var(--color-texto); }
  .ui-btn--secondary:hover { border-color: var(--color-acento-border); background: var(--color-acento-tinte); }

  /* Secundario que debe verse (U10: "Reiniciar filtros"): borde y texto de acento, sin relleno lleno. */
  .ui-btn--accent { border-color: var(--color-acento-border); background: var(--color-acento-tinte); color: var(--color-acento); }
  .ui-btn--accent:hover { border-color: var(--color-acento); background: var(--color-acento-dim); }

  .ui-btn--ghost { color: var(--color-texto-alto); }
  .ui-btn--ghost:hover { background: var(--color-superficie-2); color: var(--color-texto); }

  .ui-btn--destructive { background: var(--color-danger-dim); border-color: var(--color-danger-borde); color: var(--color-danger-texto); }
  .ui-btn--destructive:hover { border-color: var(--color-danger); }

  .ui-btn--link {
    --btn-px: 0;
    color: var(--color-acento);
    font-weight: 600;
  }
  /* El subrayado va en la etiqueta: un ítem flex no hereda la decoración del padre. */
  .ui-btn--link .ui-btn__label {
    text-decoration: underline;
    text-decoration-color: var(--color-acento-border);
    text-underline-offset: .25em;
  }
  .ui-btn--link:hover { color: var(--color-acento-hover); }
  .ui-btn--link:hover .ui-btn__label { text-decoration-color: currentColor; }

  /* ---- Estados ---- */
  .ui-btn:active { transform: translateY(1px); }
  .ui-btn[aria-pressed='true'] { background: var(--color-acento-dim); border-color: var(--color-acento-border); color: var(--color-acento); }
  .ui-btn--primary[aria-pressed='true'] { background: var(--color-acento); color: var(--color-sobre-acento); }

  .ui-btn:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
    box-shadow: var(--focus-ring);
  }

  .ui-btn:disabled,
  .ui-btn[aria-disabled='true'] {
    cursor: not-allowed;
    transform: none;
  }
  .ui-btn:disabled {
    background: var(--color-superficie-1);
    border-color: var(--color-linea-sutil);
    color: var(--color-texto-desactivado);
  }
  .ui-btn--ghost:disabled,
  .ui-btn--link:disabled,
  a.ui-btn--link[aria-disabled='true']:not([aria-busy]) { background: transparent; border-color: transparent; }
  a.ui-btn[aria-disabled='true']:not([aria-busy]) { color: var(--color-texto-desactivado); }
  .ui-btn[aria-busy='true'] { cursor: progress; }
</style>
