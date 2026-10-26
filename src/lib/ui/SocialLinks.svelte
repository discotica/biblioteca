<script lang="ts">
  import type { SocialLink } from '$lib/domain/profileSocial';
  import IconButton from './IconButton.svelte';
  import type { ButtonSize } from './Button.svelte';

  type Props = {
    /** Salida de `socialLinks(perfil)` o `profileSocialLinks(perfil)` (D1): ya validada y en orden fijo. */
    links: SocialLink[];
    /** Nombre accesible del grupo. */
    label?: string;
    size?: ButtonSize;
    /** Abre en otra pestaña; el nombre accesible lo avisa. */
    newTab?: boolean;
    class?: string;
  };

  let { links, label = 'Redes', size = 'md', newTab = false, class: className = '' }: Props = $props();
</script>

{#if links.length}
  <ul class="ui-social ui-social--{size} {className}" aria-label={label}>
    {#each links as link (link.network)}
      <li>
        <IconButton
          icon={link.network}
          label={`${link.label}: ${link.handle}${newTab ? ' (se abre en otra pestaña)' : ''}`}
          href={link.url}
          {size}
          target={newTab ? '_blank' : undefined}
          rel={newTab ? 'noopener noreferrer' : undefined}
        />
      </li>
    {/each}
  </ul>
{/if}

<style>
  .ui-social { display: flex; flex-wrap: wrap; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
  /* sm (32) necesita 12 px entre objetivos para su área de 44 (relevo de U5). */
  .ui-social--sm { gap: var(--space-3); }
  .ui-social li { display: flex; }
</style>
