<script lang="ts">
  import Chip from '$lib/ui/Chip.svelte';

  type Props = {
    /** Enlace al elemento: se puede abrir en otra pestaña. */
    href: string;
    title: string;
    /** Abierto en el detalle (aria-current). */
    current?: boolean;
    /** Estado, como chip a la derecha del título. */
    status?: { label: string; tone?: 'neutral' | 'accent' | 'warning' | 'danger' };
    /** Datos secundarios, en una línea separados por "·". */
    meta?: string[];
    /** Una marca destacada en la línea de datos ("2 campos editados"). */
    flag?: string;
    /**
     * Clic simple: la sección elige el elemento sin recargar. Con una tecla
     * modificadora o el botón central, el enlace se comporta como enlace.
     */
    onselect?: () => void;
    [attribute: string]: unknown;
  };

  let { href, title, current = false, status, meta = [], flag, onselect, ...rest }: Props = $props();

  function click(event: MouseEvent) {
    if (!onselect || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onselect();
  }
</script>

<!-- Un elemento de la bandeja del Estudio (U17), en filas de 56 o más: título y, debajo, estado y datos. -->
<a class="l-inbox-item" {href} aria-current={current ? 'true' : undefined} onclick={click} {...rest}>
  <span class="l-inbox-item__title">{title}</span>
  {#if status || meta.length || flag}
    <span class="l-inbox-item__meta">
      {#if status}<Chip kind="status" label={status.label} tone={status.tone ?? 'neutral'} />{/if}
      {#if flag}<span class="l-inbox-item__part l-inbox-item__flag">{flag}</span>{/if}
      {#each meta as part}<span class="l-inbox-item__part">{part}</span>{/each}
    </span>
  {/if}
</a>

<style>
  .l-inbox-item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
    min-height: var(--tool-row-h);
    box-sizing: border-box;
    padding: var(--space-2) var(--space-4);
    border-left: 2px solid transparent;
    color: var(--color-texto-medio);
    text-decoration: none;
  }
  .l-inbox-item:hover { background: var(--color-superficie-2); color: var(--color-texto); }
  .l-inbox-item:focus-visible {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: -2px;
    box-shadow: var(--focus-ring);
  }
  .l-inbox-item[aria-current='true'] {
    border-left-color: var(--color-acento);
    background: var(--color-acento-dim);
    color: var(--color-texto);
  }

  .l-inbox-item__title {
    min-width: 0;
    color: var(--color-texto);
    font-size: var(--density-text);
    font-weight: 650;
    line-height: var(--leading-heading);
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Estado, marca y datos en una línea; lo que no cabe se corta al final. */
  .l-inbox-item__meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    overflow: hidden;
    color: var(--color-texto-tenue);
    font-size: var(--text-2xs);
    white-space: nowrap;
  }
  .l-inbox-item__part { min-width: 0; overflow: hidden; text-overflow: ellipsis; flex: none; }
  .l-inbox-item__part:last-child { flex: 0 1 auto; }
  .l-inbox-item__part + .l-inbox-item__part::before {
    content: '·';
    margin-right: var(--space-2);
  }

  .l-inbox-item__flag { color: var(--color-aviso); font-weight: 650; }
</style>
