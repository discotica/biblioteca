<script module lang="ts">
  import type { SourceProvider } from '$lib/stores/contributionsStore';

  /** Nombre visible de cada proveedor de fuente que reconoce Sugerir (E09). */
  export const SOURCE_PROVIDER_NAMES: Record<SourceProvider, string> = {
    bandcamp: 'Bandcamp',
    soundcloud: 'SoundCloud',
    spotify: 'Spotify'
  };
</script>

<script lang="ts">
  import { sourceProviderFor } from '$lib/stores/contributionsStore';
  import IconButton from './IconButton.svelte';
  import type { ButtonSize } from './Button.svelte';

  type Props = {
    /** URL de la fuente. El proveedor se detecta con la misma regla que Sugerir. */
    href: string;
    /**
     * Proveedor ya conocido (p. ej. `source_provider` de una propuesta). Si no
     * se da, o no es uno de los tres, se detecta de `href`.
     */
    provider?: string | null;
    /** Sustituye el nombre accesible y la ayuda («Abrir en {Proveedor}»). */
    label?: string;
    variant?: 'ghost' | 'secondary';
    size?: ButtonSize;
    tooltip?: 'top' | 'bottom';
    tooltipAlign?: 'center' | 'start' | 'end';
    class?: string;
  };

  let { href, provider, label, variant = 'secondary', size = 'md', tooltip = 'top', tooltipAlign = 'center', class: className = '' }: Props = $props();

  const known = (value: string | null | undefined): SourceProvider | null =>
    value && value.toLowerCase() in SOURCE_PROVIDER_NAMES ? (value.toLowerCase() as SourceProvider) : null;

  const detected = $derived(known(provider) ?? sourceProviderFor(href));
  const name = $derived(label ?? (detected ? `Abrir en ${SOURCE_PROVIDER_NAMES[detected]}` : 'Abrir la fuente'));
</script>

<!-- Botón de fuente (U20, tablero 4b del lienzo): el glifo del proveedor o una
     flecha externa para cualquier otro enlace. Abre en otra pestaña. -->
<IconButton
  class="ui-source-link {className}"
  icon={detected ?? 'flecha-externa'}
  label={name}
  {href}
  {variant}
  {size}
  {tooltip}
  {tooltipAlign}
  target="_blank"
  rel="noopener noreferrer"
  data-provider={detected ?? 'otro'}
/>
