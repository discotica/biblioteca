<script module lang="ts">
  import { SOCIAL_NETWORKS, socialProfileUrl, type SocialNetwork, type SocialProfileColumns } from '$lib/domain/profileSocial';

  export type SocialFormValues = Record<SocialNetwork, string>;

  export function emptySocialForm(): SocialFormValues {
    return { bandcamp: '', soundcloud: '', instagram: '', x: '', facebook: '' };
  }

  /** Valores editables desde el perfil: Bandcamp como enlace (necesita la forma), el resto como usuario. */
  export function socialFormFromProfile(profile: SocialProfileColumns): SocialFormValues {
    const values = emptySocialForm();
    for (const network of SOCIAL_NETWORKS) {
      const handle = profile[`social_${network}`] ?? '';
      values[network] =
        network === 'bandcamp' ? (socialProfileUrl('bandcamp', handle, profile.social_bandcamp_kind) ?? '') : handle;
    }
    return values;
  }
</script>

<script lang="ts">
  import { Field } from '$lib/ui';
  import { socialLabel, type SocialFieldErrors } from '$lib/domain/profileSocial';

  type Props = {
    values: SocialFormValues;
    errors?: SocialFieldErrors;
    disabled?: boolean;
    /** Orden de los campos. Por defecto, el del perfil; el alta (U30) abre con Instagram. */
    order?: readonly SocialNetwork[];
  };

  let { values = $bindable(), errors = {}, disabled = false, order = SOCIAL_NETWORKS }: Props = $props();

  // Bandcamp pide el enlace: un nombre suelto no dice si es página de artista o de fan (D1).
  // Los placeholders son los del tablero K (U30): el enlace tal como se pega.
  const PLACEHOLDERS: Record<SocialNetwork, string> = {
    bandcamp: 'tuusuario.bandcamp.com',
    soundcloud: 'soundcloud.com/tu_usuario',
    instagram: 'instagram.com/tu_usuario',
    x: 'x.com/tu_usuario',
    facebook: 'facebook.com/tu_usuario'
  };
</script>

<div class="social-fields">
  {#each order as network (network)}
    <Field
      label={socialLabel(network)}
      name={`social_${network}`}
      type={network === 'bandcamp' ? 'url' : 'text'}
      bind:value={values[network]}
      placeholder={PLACEHOLDERS[network]}
      hint={network === 'bandcamp' ? 'Pega el enlace a tu página de artista o de fan.' : undefined}
      error={errors[network]}
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      {disabled}
    />
  {/each}
</div>

<style>
  .social-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>
