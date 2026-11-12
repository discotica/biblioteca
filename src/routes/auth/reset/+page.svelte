<script lang="ts">
  import { onMount } from 'svelte';
  import AccesoPagina from '$lib/components/account/AccesoPagina.svelte';
  import AccesoTitulo from '$lib/components/account/AccesoTitulo.svelte';
  import { Button, FormPanel, Notice, PasswordField } from '$lib/ui';
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';
  import { readAuthLink, type AuthLinkFlow } from '$lib/domain/account';
  import { ownProfilePath } from '$lib/services/profiles';

  /**
   * Destino de los enlaces de los correos de Auth: confirmar la cuenta,
   * elegir contraseña nueva y confirmar un cambio de correo (RC2-P0-01).
   * - `?token_hash=…&type=…` (las plantillas): se canjea aquí con `verifyOtp`.
   *   No depende del navegador en que se pidió el enlace.
   * - `?code=…` (enlaces PKCE anteriores): el SDK ya lo canjeó al cargar
   *   (`detectSessionInUrl`). Canjearlo otra vez falla, así que solo se mira la sesión.
   * - `#access_token=…` (flujo implícito): igual, la sesión ya está creada.
   */
  let flow = $state<AuthLinkFlow | null>(null);
  let linkError = $state(false);
  /** Cambio de correo con doble confirmación: falta el enlace de la otra dirección. */
  let otherAddressPending = $state(false);
  /** El formulario de contraseña no aparece hasta que el enlace está verificado. */
  let checking = $state(true);
  let password = $state('');
  let passwordValid = $state(false);
  let confirmPassword = $state('');
  let errors = $state<{ password?: string; confirm?: string }>({});
  let formError = $state('');
  let loading = $state(false);

  const title = $derived(
    linkError
      ? 'El enlace venció'
      : otherAddressPending
        ? 'Falta un paso'
        : flow === 'recovery' && !checking
          ? 'Contraseña nueva'
          : 'Comprobando el enlace'
  );

  /** El formulario de la contraseña nueva: solo con el enlace de recuperación ya verificado. */
  const askPassword = $derived(flow === 'recovery' && !checking && !linkError && !otherAddressPending);

  onMount(async () => {
    await checkLink();
    checking = false;
  });

  async function checkLink() {
    const link = readAuthLink($page.url.searchParams, new URLSearchParams(window.location.hash.slice(1)));
    flow = link.flow;
    if (link.error) {
      linkError = true;
      return;
    }

    if (link.tokenHash && link.otpType) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.otpType });
      // El token es de un solo uso: fuera de la URL, recargar no lo reintenta.
      replaceState(`/auth/reset?flow=${link.flow}`, {});
      if (error) {
        linkError = true;
        return;
      }
      if (!data.session) {
        // Auth acepta la primera de las dos confirmaciones de un cambio de correo sin abrir sesión.
        if (link.flow === 'email_change') otherAddressPending = true;
        else linkError = true;
        return;
      }
    } else {
      // getSession espera a que el SDK termine de leer la URL (code o fragmento).
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        linkError = true;
        return;
      }
    }

    // La cuenta confirmada aterriza en su perfil (U30), con el aviso.
    if (flow === 'signup') goto(`${await ownProfilePath()}?aviso=cuenta-confirmada`, { replaceState: true });
    else if (flow === 'email_change') goto('/cuenta?aviso=correo', { replaceState: true });
  }

  async function updatePassword(event: SubmitEvent) {
    event.preventDefault();
    formError = '';
    errors = {
      password: passwordValid ? undefined : 'La contraseña necesita 8 caracteres o más.',
      confirm: confirmPassword === password ? undefined : 'Las contraseñas no coinciden.'
    };
    if (errors.password || errors.confirm) return;

    loading = true;
    const { error } = await supabase.auth.updateUser({ password });
    loading = false;
    if (error) {
      formError =
        error.code === 'same_password'
          ? 'La contraseña nueva tiene que ser distinta de la anterior.'
          : error.code === 'weak_password'
            ? 'Esa contraseña es demasiado fácil de adivinar. Prueba con otra.'
            : 'No pudimos guardar la contraseña. Vuelve a intentarlo.';
      return;
    }
    goto(`${await ownProfilePath()}?aviso=contrasena`, { replaceState: true });
  }
</script>

<svelte:head>
  <title>{flow === 'recovery' ? 'Nueva contraseña' : 'Confirmar enlace'} — Biblioteca Discótica</title>
</svelte:head>

{#snippet acciones()}
  {#if linkError}
    <div class="link-actions">
      {#if flow === 'signup'}
        <Button href="/auth/confirmar" size="form" block>Pedir otro enlace</Button>
        <a class="link-discreto" href="/auth/login">Entrar</a>
      {:else if flow === 'email_change'}
        <Button href="/cuenta" size="form" block>Ir a mi cuenta</Button>
      {:else}
        <Button href="/auth/recuperar" size="form" block>Pedir otro enlace</Button>
      {/if}
    </div>
  {:else if otherAddressPending}
    <div class="link-actions">
      <Button href="/cuenta" variant="secondary" size="form" block>Ir a mi cuenta</Button>
    </div>
  {:else}
    <Button type="submit" size="form" block {loading}>Guardar contraseña</Button>
  {/if}
{/snippet}

<!-- Tablero M: panel de 480 sobre la huella gris. Enlace vencido sin aviso rojo: una salida clara. -->
<AccesoPagina contenedor="narrow" alinea="centro">
  <FormPanel
    as={askPassword ? 'form' : 'div'}
    size="narrow"
    actions={checking ? undefined : acciones}
    onsubmit={updatePassword}
    novalidate
  >
    {#if linkError}
      <AccesoTitulo titulo={title}>
        {#if flow === 'email_change'}
          Ya se usó o pasó demasiado tiempo. Puedes pedir el cambio de correo otra vez desde tu cuenta.
        {:else if flow === 'signup'}
          Ya se usó o pasó demasiado tiempo. Si ya confirmaste tu cuenta, puedes entrar.
        {:else}
          Ya se usó o pasó demasiado tiempo.
        {/if}
      </AccesoTitulo>
    {:else if otherAddressPending}
      <AccesoTitulo titulo={title}>
        Confirmamos esta dirección. Abre también el enlace que llegó a la otra dirección para terminar el cambio de correo.
      </AccesoTitulo>
    {:else if askPassword}
      <AccesoTitulo titulo={title} />
      <PasswordField label="Contraseña nueva" name="password" bind:value={password} bind:valid={passwordValid} error={errors.password} required />
      <PasswordField
        label="Repite la contraseña"
        name="password-confirm"
        autocomplete="new-password"
        showRules={false}
        bind:value={confirmPassword}
        error={errors.confirm}
        required
      />
      {#if formError}<Notice tone="error">{formError}</Notice>{/if}
    {:else}
      <AccesoTitulo titulo={title} />
      <p class="checking" role="status">Un momento…</p>
    {/if}
  </FormPanel>
</AccesoPagina>

<style>
  .link-actions { display: flex; flex-direction: column; gap: var(--space-2); width: 100%; }
  .link-discreto {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--target-touch);
    color: var(--color-texto-alto);
    font-size: var(--text-sm);
    font-weight: 500;
    text-decoration: none;
    transition: color var(--motion-fast) ease;
  }
  .link-discreto:hover { color: var(--color-acento); }
  .checking {
    margin: 0;
    color: var(--color-texto-medio);
    font-size: var(--text-sm);
  }
</style>
