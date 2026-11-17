<script lang="ts">
  // Editar perfil (U33, tablero M): lo que ve la gente. Cenefa pequeña con
  // «@usuario», nombre para mostrar, sobre ti y redes. Correo, contraseña y
  // novedades viven en /cuenta/ajustes.
  import { onMount, tick } from 'svelte';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import FormSection from '$lib/components/account/FormSection.svelte';
  import SocialFields, { emptySocialForm, socialFormFromProfile } from '$lib/components/account/SocialFields.svelte';
  import { Button, Field, FormPanel, Notice, Textarea } from '$lib/ui';
  import { Cenefa, type Rol } from '$lib/generative';
  import { loadProfileRole, profileRole } from '$lib/stores/profileRole';
  import { loadOwnAccountProfile, updateOwnAccountProfile, type OwnAccountProfile } from '$lib/services/profiles';
  import type { SocialFieldErrors } from '$lib/domain/profileSocial';

  let { data }: { data: { userId: string; email: string; newEmail: string } } = $props();

  type Message = { tone: 'success' | 'error'; text: string } | null;

  let profile = $state<OwnAccountProfile | null>(null);
  let socialAvailable = $state(false);
  let loadError = $state('');
  let displayName = $state('');
  let bio = $state('');
  let social = $state(emptySocialForm());
  let socialErrors = $state<SocialFieldErrors>({});
  let message = $state<Message>(null);
  let saving = $state(false);

  // La huella lleva el color del rol (§2): verdes, grises o morado.
  const rol = $derived.by<Rol>(() => {
    const value = $profileRole?.userId === data.userId ? $profileRole.role : '';
    return value === 'admin' ? 'admin' : value === 'colaborador' ? 'colaborador' : 'usuario';
  });

  function fillForm(next: OwnAccountProfile) {
    profile = next;
    displayName = next.display_name ?? '';
    bio = next.bio ?? '';
    if (socialAvailable) social = socialFormFromProfile(next);
  }

  async function load() {
    loadError = '';
    try {
      const result = await loadOwnAccountProfile(data.userId);
      socialAvailable = result.socialAvailable;
      fillForm(result.profile);
    } catch {
      loadError = 'No pudimos cargar tu cuenta.';
    }
  }

  onMount(() => {
    void load();
    void loadProfileRole(data.userId).catch(() => {});
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!profile) return;
    message = null;
    socialErrors = {};
    saving = true;
    try {
      const result = await updateOwnAccountProfile(profile.id, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        social: socialAvailable ? social : undefined
      });
      if (result.ok) {
        fillForm(result.profile);
        message = { tone: 'success', text: 'Guardamos los cambios.' };
      } else {
        socialErrors = result.errors;
        message = { tone: 'error', text: 'Revisa las redes marcadas.' };
        await tick();
        document.querySelector<HTMLElement>('.cuenta-form [aria-invalid="true"]')?.focus();
      }
    } catch {
      message = { tone: 'error', text: 'No pudimos guardar los cambios. Vuelve a intentarlo.' };
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Editar perfil — Biblioteca Discótica</title>
</svelte:head>

<AccesoPagina contenedor="narrow" alinea="arriba">
  <h1 class="sr-only">Editar perfil</h1>
  {#if loadError}
    <FormPanel size="wide">
      <Notice tone="error">
        {loadError}
        {#snippet actions()}<Button variant="secondary" size="sm" onclick={load}>Reintentar</Button>{/snippet}
      </Notice>
    </FormPanel>
  {:else if !profile}
    <FormPanel size="wide">
      <p class="cuenta-carga" role="status">Cargando tu cuenta…</p>
    </FormPanel>
  {:else}
    <FormPanel as="form" size="wide" class="cuenta-form" onsubmit={save} novalidate aria-label="Editar perfil">
      <Cenefa nombre={profile.username} {rol} alto={96} velo={false} class="cuenta-cenefa">
        <div class="cuenta-cenefa__velo" aria-hidden="true"></div>
        <p class="cuenta-cenefa__nombre">@{profile.username}</p>
      </Cenefa>

      <Field
        label="Nombre para mostrar"
        name="display_name"
        autocomplete="name"
        maxlength={60}
        optional
        bind:value={displayName}
        hint="Si lo dejas vacío, se muestra tu usuario."
      />
      <Textarea label="Sobre ti" name="bio" optional maxlength={280} rows={3} bind:value={bio} />

      {#if socialAvailable}
        <FormSection id="redes" legend="Redes" optional description="Aparecen en tu perfil. Deja un campo vacío para quitar esa red.">
          <SocialFields bind:values={social} errors={socialErrors} />
        </FormSection>
      {/if}

      {#if message}<Notice tone={message.tone}>{message.text}</Notice>{/if}

      {#snippet actions()}
        <Button type="submit" size="form" block loading={saving}>Guardar cambios</Button>
      {/snippet}
    </FormPanel>
  {/if}
</AccesoPagina>

<style>
  .cuenta-carga {
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
  }

  /* La cenefa pequeña ocupa el ancho del panel y se redondea como un campo. */
  :global(.cuenta-cenefa) {
    border-radius: var(--radius-sm);
  }
  .cuenta-cenefa__velo {
    position: absolute;
    inset: 0;
    background: var(--cenefa-menor-velo);
  }
  .cuenta-cenefa__nombre {
    position: absolute;
    left: var(--space-3);
    bottom: var(--space-2);
    max-width: calc(100% - 2 * var(--space-3));
    margin: 0;
    overflow: hidden;
    color: var(--color-texto);
    font-size: var(--text-cenefa-menor);
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: var(--text-cenefa-menor-lh);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
