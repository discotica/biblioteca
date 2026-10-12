<script lang="ts">
  import { ICONS, type IconName, type IconDefinition } from './icons';

  type Props = {
    name: IconName;
    /** sm 16 · md 20 · lg 24 · `em` sigue el tamaño del texto. */
    size?: 'sm' | 'md' | 'lg' | 'em';
    /** Solo si el icono comunica algo por sí mismo; si acompaña a un texto, se omite. */
    label?: string;
    /** bold: trazo más grueso, para acompañar texto en negrita. */
    weight?: 'regular' | 'bold';
    class?: string;
  };

  let { name, size = 'md', label, weight = 'regular', class: className = '' }: Props = $props();

  const icon = $derived(ICONS[name] as IconDefinition);
</script>

<svg
  class="ui-icon ui-icon--{size} {className}"
  class:ui-icon--filled={icon.filled}
  class:ui-icon--bold={weight === 'bold'}
  viewBox={icon.viewBox ?? '0 0 24 24'}
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  {#each icon.paths as path}
    {#if typeof path === 'string'}
      <path d={path} />
    {:else}
      <path d={path.d} class="ui-icon__fill" />
    {/if}
  {/each}
</svg>

<style>
  .ui-icon {
    flex: none;
    display: block;
    width: var(--icon-md);
    height: var(--icon-md);
    fill: none;
    stroke: currentColor;
    stroke-width: var(--icon-stroke);
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ui-icon--sm { width: var(--icon-sm); height: var(--icon-sm); }
  .ui-icon--lg { width: var(--icon-lg); height: var(--icon-lg); }
  .ui-icon--em { width: 1em; height: 1em; }
  .ui-icon--bold { stroke-width: var(--icon-stroke-bold); }
  .ui-icon--filled { fill: currentColor; stroke: none; }
  .ui-icon__fill { fill: currentColor; }
</style>
